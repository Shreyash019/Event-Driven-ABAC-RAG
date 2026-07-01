import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { SessionUser } from '@arac/types';
import { type AbacIdentity, TokenService } from '../jwt/token.service';
import {
  IDENTITY_PROVIDER,
  type IdentityProvider,
  type User,
} from '../users/user.store';
import {
  SESSION_STORE,
  type SessionStore,
} from '../sessions/session.store';
import { PERMISSIONS, RbacService } from '../rbac/rbac.service';
import { OrgService } from '../org/org.service';

/**
 * Orchestrates the auth flows (loc-doc/AuthService.md §6, Phase E): credential check →
 * mint access JWT + open a refresh session; rotate on refresh; logout / logout-all; me.
 *
 * This service NEVER returns tokens on an error path — every failure throws
 * UnauthorizedException and issues nothing (fail-closed, GUARDRAILS §1.4). It deals in
 * token/identity values only; the controller owns HTTP concerns (cookies, status).
 */

/** Everything the controller needs to respond + set cookies after login/refresh. */
export interface AuthResult {
  accessToken: string;
  accessExpiresAt: number;
  refreshToken: string;
  refreshExpiresAt: number;
  user: SessionUser;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly tokens: TokenService,
    @Inject(IDENTITY_PROVIDER) private readonly identity: IdentityProvider,
    @Inject(SESSION_STORE) private readonly sessions: SessionStore,
    private readonly rbac: RbacService,
    private readonly org: OrgService,
  ) {}

  /** Verify credentials, then issue an access token + open a refresh session. */
  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.identity.verifyCredentials(email, password);
    if (!user) {
      // Generic failure — no signal whether the email or the password was wrong.
      this.logger.warn('audit login.failure'); // no PII — failure event only
      throw new UnauthorizedException('Invalid credentials');
    }
    this.audit('login.success', { user: user.id });
    return this.issueFor(user);
  }

  /**
   * Self-registration. The new account is created with forced minimal scope (it can sign
   * in but sees nothing until an admin grants attributes — GUARDRAILS §1.5). On success
   * the user is auto-logged-in (tokens issued) for a smooth flow.
   */
  async signup(email: string, name: string, password: string): Promise<AuthResult> {
    const user = await this.identity.createUser({ email, name, password });
    if (!user) {
      throw new ConflictException('An account with this email already exists');
    }
    this.audit('signup.success', { user: user.id });
    return this.issueFor(user);
  }

  /**
   * Change the caller's password. Requires the current password (defeats a hijacked
   * session silently changing it), then revokes EVERY session for the user so any stolen
   * refresh token dies, and re-issues a fresh session for the current device.
   */
  async changePassword(
    accessToken: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<AuthResult> {
    const verified = await this.verify(accessToken);
    const user = await this.identity.findById(verified.sub);
    if (!user) throw new UnauthorizedException('Invalid access token');

    const ok = await this.identity.verifyCredentials(user.email, currentPassword);
    if (!ok) throw new UnauthorizedException('Current password is incorrect');

    await this.identity.changePassword(user.id, newPassword);
    await this.sessions.revokeUser(user.id); // kill all sessions everywhere
    this.audit('password.changed', { user: user.id });
    return this.issueFor(user); // re-issue for the current device
  }

  /**
   * Rotate a refresh token and mint a fresh access token. Any non-`rotated` outcome —
   * unknown, expired, or replay (theft) — denies and issues nothing.
   */
  async refresh(presentedRefreshToken: string): Promise<AuthResult> {
    const result = await this.sessions.rotate(presentedRefreshToken);

    if (result.status === 'reuse_detected') {
      // Family already revoked by the store; record the security event by id only.
      this.logger.warn(
        `audit refresh.reuse_detected family=${result.familyId} user=${result.userId} (family revoked)`,
      );
      throw new UnauthorizedException('Session revoked');
    }
    if (result.status !== 'rotated') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.identity.findById(result.userId);
    if (!user) {
      // Session valid but the user vanished (deleted/disabled): fail closed and clean up.
      await this.sessions.revokeUser(result.userId);
      throw new UnauthorizedException('Invalid refresh token');
    }

    this.audit('refresh.rotated', { user: user.id, family: result.familyId });
    const access = await this.tokens.signAccessToken(await this.toIdentity(user));
    return {
      accessToken: access.token,
      accessExpiresAt: access.expiresAt,
      refreshToken: result.refresh.token,
      refreshExpiresAt: result.refresh.expiresAt,
      user: this.toSessionUser(user),
    };
  }

  /** Revoke the session (family) the presented refresh token belongs to. */
  async logout(presentedRefreshToken: string): Promise<void> {
    await this.sessions.revoke(presentedRefreshToken);
  }

  /** Revoke every session for the user behind a valid access token (logout-all). */
  async logoutAll(accessToken: string): Promise<void> {
    const verified = await this.verify(accessToken);
    await this.sessions.revokeUser(verified.sub);
    this.audit('logout.all', { user: verified.sub });
  }

  /** Emit a redacted audit line (ids/decisions only — never tokens/PII; GUARDRAILS §6.1). */
  private audit(event: string, fields: Record<string, string | number> = {}): void {
    const kv = Object.entries(fields)
      .map(([k, v]) => `${k}=${v}`)
      .join(' ');
    this.logger.log(`audit ${event}${kv ? ` ${kv}` : ''}`);
  }

  /** Resolve the current SessionUser from a valid access token (frontend SSR /me). */
  async me(accessToken: string): Promise<SessionUser> {
    const verified = await this.verify(accessToken);
    const user = await this.identity.findById(verified.sub);
    if (!user) throw new UnauthorizedException('Unknown subject');
    const [roles, canManageUsers] = await Promise.all([
      this.rbac.rolesFor(user.id),
      this.rbac.can(user.id, PERMISSIONS.USERS_READ),
    ]);
    return { ...this.toSessionUser(user), roles, canManageUsers };
  }

  private async issueFor(user: User): Promise<AuthResult> {
    const access = await this.tokens.signAccessToken(await this.toIdentity(user));
    const refresh = await this.sessions.createSession(user.id);
    return {
      accessToken: access.token,
      accessExpiresAt: access.expiresAt,
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
      user: this.toSessionUser(user),
    };
  }

  /** Verify an access token, converting any jose failure into a 401 (fail-closed). */
  private async verify(accessToken: string) {
    try {
      return await this.tokens.verifyAccessToken(accessToken);
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  private async toIdentity(user: User): Promise<AbacIdentity> {
    const { departments, compartments } = await this.org.effectiveClaims(user.id);
    return {
      sub: user.id,
      tenant: user.tenant,
      departments,
      clearance: user.clearance,
      level: user.level,
      compartments,
    };
  }

  private toSessionUser(user: User): SessionUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      department: user.department,
    };
  }
}
