import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import { PERMISSIONS, RbacService, type Scope } from '../rbac/rbac.service';
import { SESSION_STORE, type SessionStore } from '../sessions/session.store';
import { TokenService } from '../jwt/token.service';

/**
 * Admin operations on users, authorized by scoped RBAC (RbacService). Listing returns
 * only the users within the caller's scope; granting requires `users:grant` covering both
 * the target's current scope AND the new scope (so a dept-admin can't move a user into a
 * department they don't manage). Never exposes password hashes (GUARDRAILS §6.1).
 */

const PUBLIC_USER_FIELDS = {
  id: true,
  email: true,
  name: true,
  tenant: true,
  department: true,
  clearance: true,
  status: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type AdminUserView = Prisma.UserGetPayload<{ select: typeof PUBLIC_USER_FIELDS }>;

export interface GrantInput {
  tenant?: string;
  department?: string;
  clearance?: number;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly tokens: TokenService,
    private readonly rbac: RbacService,
    private readonly prisma: PrismaService,
    @Inject(SESSION_STORE) private readonly sessions: SessionStore,
  ) {}

  /** Users the caller may see, filtered to their `users:read` scopes. */
  async listUsers(accessToken: string): Promise<AdminUserView[]> {
    const callerId = await this.callerId(accessToken);
    const scopes = await this.rbac.scopesFor(callerId, PERMISSIONS.USERS_READ);
    if (scopes.length === 0) throw new ForbiddenException('Not permitted');

    return this.prisma.user.findMany({
      where: scopeWhere(scopes),
      orderBy: { createdAt: 'asc' },
      select: PUBLIC_USER_FIELDS,
    });
  }

  /** Set a user's ABAC attributes; requires `users:grant` over both old and new scope. */
  async grantAttributes(
    accessToken: string,
    targetId: string,
    input: GrantInput,
  ): Promise<AdminUserView> {
    const callerId = await this.callerId(accessToken);

    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('User not found');

    const next = {
      tenant: input.tenant ?? target.tenant,
      department: input.department ?? target.department,
      clearance: input.clearance ?? target.clearance,
    };

    const overOld = await this.rbac.can(callerId, PERMISSIONS.USERS_GRANT, {
      tenant: target.tenant,
      department: target.department,
    });
    const overNew = await this.rbac.can(callerId, PERMISSIONS.USERS_GRANT, {
      tenant: next.tenant,
      department: next.department,
    });
    if (!overOld || !overNew) {
      throw new ForbiddenException('Not permitted for that scope');
    }

    const updated = await this.prisma.user.update({
      where: { id: targetId },
      data: next,
      select: PUBLIC_USER_FIELDS,
    });

    // Revoke the target's sessions so a scope reduction takes effect immediately rather
    // than lingering in an unexpired access token (and a grant is picked up on re-login).
    await this.sessions.revokeUser(targetId);
    return updated;
  }

  private async callerId(accessToken: string): Promise<string> {
    try {
      return (await this.tokens.verifyAccessToken(accessToken)).sub;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}

/** Build a Prisma filter from the caller's scopes; undefined = global (no filter). */
function scopeWhere(scopes: Scope[]): Prisma.UserWhereInput | undefined {
  if (scopes.some((s) => s.tenant === null && s.department === null)) return undefined;
  return {
    OR: scopes.map((s) => ({
      ...(s.tenant !== null ? { tenant: s.tenant } : {}),
      ...(s.department !== null ? { department: s.department } : {}),
    })),
  };
}
