import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';

/**
 * Refresh-token sessions with rotation + reuse (theft) detection.
 * The security core of AuthService.md §3.2.
 *
 * Model: each login opens a session = a refresh-token "family". Every /auth/refresh
 * ROTATES — the presented token is retired and a fresh one is minted in the same family.
 * If a token that was already rotated out is presented again, it leaked: the whole
 * family is revoked and the user must log in again. This converts a stolen refresh token
 * from silent persistent access into a one-shot that trips an alarm.
 *
 * Tokens are opaque 256-bit random values. We store ONLY their SHA-256 hash, so a store
 * breach yields nothing usable (a hash can't be presented). SHA-256 (not argon2) is
 * correct here because the token is already high-entropy — no password to slow-hash.
 *
 * This in-memory impl is the PoC store (AuthService.md §3.6); a Postgres/dedicated-Redis
 * impl can replace it behind `SessionStore` without changing the rotation logic.
 */

/** DI token so consumers depend on the interface, not the concrete store. */
export const SESSION_STORE = Symbol('SESSION_STORE');
/** DI token carrying the refresh-token lifetime in seconds. */
export const REFRESH_TTL_SECONDS = Symbol('REFRESH_TTL_SECONDS');

export interface IssuedRefreshToken {
  /** The opaque token — returned to the caller ONCE; only its hash is stored. */
  token: string;
  familyId: string;
  /** Unix seconds at which the token expires. */
  expiresAt: number;
}

export type RotationResult =
  | { status: 'rotated'; userId: string; familyId: string; refresh: IssuedRefreshToken }
  | { status: 'invalid' }
  | { status: 'expired' }
  | { status: 'reuse_detected'; userId: string; familyId: string };

export interface SessionStore {
  /** Open a new session (family) for a user and issue its first refresh token. */
  createSession(userId: string): Promise<IssuedRefreshToken>;
  /** Rotate on a presented refresh token; see RotationResult for outcomes. */
  rotate(presentedToken: string): Promise<RotationResult>;
  /** Revoke the family that the presented token belongs to (logout). Idempotent. */
  revoke(presentedToken: string): Promise<void>;
  /** Revoke every session for a user (logout-all / password change). */
  revokeUser(userId: string): Promise<void>;
}

interface SessionRecord {
  tokenHash: string;
  familyId: string;
  userId: string;
  expiresAt: number;
  /** True once this token has been rotated out; replay of a used token = theft. */
  used: boolean;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

@Injectable()
export class InMemorySessionStore implements SessionStore {
  private readonly byHash = new Map<string, SessionRecord>();
  /** familyId -> set of token hashes, so a whole family can be revoked at once. */
  private readonly families = new Map<string, Set<string>>();

  constructor(@Inject(REFRESH_TTL_SECONDS) private readonly ttlSeconds: number) {}

  async createSession(userId: string): Promise<IssuedRefreshToken> {
    return this.issue(userId, randomUUID());
  }

  async rotate(presentedToken: string): Promise<RotationResult> {
    const record = this.byHash.get(sha256(presentedToken));
    if (!record) return { status: 'invalid' };

    if (record.used) {
      // Replay of a retired token → theft. Burn the entire family.
      this.revokeFamily(record.familyId);
      return { status: 'reuse_detected', userId: record.userId, familyId: record.familyId };
    }

    if (nowSeconds() > record.expiresAt) {
      // Expiry is not theft; drop just this token, leave the family intact.
      this.remove(record);
      return { status: 'expired' };
    }

    // Valid: retire this token (kept for replay detection) and mint a successor.
    record.used = true;
    const refresh = this.issue(record.userId, record.familyId);
    return { status: 'rotated', userId: record.userId, familyId: record.familyId, refresh };
  }

  async revoke(presentedToken: string): Promise<void> {
    const record = this.byHash.get(sha256(presentedToken));
    if (record) this.revokeFamily(record.familyId);
  }

  async revokeUser(userId: string): Promise<void> {
    const familyIds = new Set<string>();
    for (const record of this.byHash.values()) {
      if (record.userId === userId) familyIds.add(record.familyId);
    }
    for (const familyId of familyIds) this.revokeFamily(familyId);
  }

  private issue(userId: string, familyId: string): IssuedRefreshToken {
    const token = randomBytes(32).toString('base64url'); // 256-bit opaque secret
    const tokenHash = sha256(token);
    const expiresAt = nowSeconds() + this.ttlSeconds;

    this.byHash.set(tokenHash, { tokenHash, familyId, userId, expiresAt, used: false });
    let family = this.families.get(familyId);
    if (!family) {
      family = new Set<string>();
      this.families.set(familyId, family);
    }
    family.add(tokenHash);

    return { token, familyId, expiresAt };
  }

  private revokeFamily(familyId: string): void {
    const family = this.families.get(familyId);
    if (!family) return;
    for (const tokenHash of family) this.byHash.delete(tokenHash);
    this.families.delete(familyId);
  }

  private remove(record: SessionRecord): void {
    this.byHash.delete(record.tokenHash);
    this.families.get(record.familyId)?.delete(record.tokenHash);
  }
}
