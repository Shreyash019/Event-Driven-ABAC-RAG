import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import type { MailConfig } from '../config/configuration';
import { PrismaService } from '../db/prisma.service';
import { REDIS_CLIENT } from '../db/redis.provider';
import { MailerService } from '../mail/mailer.service';
import { SESSION_STORE, type SessionStore } from '../sessions/session.store';
import { IDENTITY_PROVIDER, type IdentityProvider } from '../users/user.store';

/**
 * Forgot/reset password. Reset tokens are high-entropy, stored only as a SHA-256 hash in
 * Redis with a short TTL, and single-use (atomic GETDEL). requestReset is always silent
 * (no enumeration); reset revokes all sessions so a compromised password can't linger.
 */
const RESET_PREFIX = 'pwreset:';
const RESET_TTL_SECONDS = 1800; // 30 minutes

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly appBaseUrl: string;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService,
    @Inject(IDENTITY_PROVIDER) private readonly identity: IdentityProvider,
    @Inject(SESSION_STORE) private readonly sessions: SessionStore,
    private readonly mailer: MailerService,
    config: ConfigService,
  ) {
    this.appBaseUrl = config.getOrThrow<MailConfig>('mail').appBaseUrl;
  }

  /** Email a reset link if the account exists+active. Always resolves (no enumeration). */
  async requestReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, email: true, status: true },
    });
    if (!user || user.status !== 'ACTIVE') return;

    const token = randomBytes(32).toString('base64url');
    await this.redis.set(`${RESET_PREFIX}${sha256(token)}`, user.id, 'EX', RESET_TTL_SECONDS);
    const url = `${this.appBaseUrl}/reset-password?token=${encodeURIComponent(token)}`;
    await this.mailer.sendPasswordReset(user.email, url);
    this.logger.log(`audit password_reset.requested user=${user.id}`);
  }

  /** Consume a reset token (single-use) and set the new password. Returns false if invalid. */
  async reset(token: string, newPassword: string): Promise<boolean> {
    const userId = await this.redis.getdel(`${RESET_PREFIX}${sha256(token)}`);
    if (!userId) return false;

    await this.identity.changePassword(userId, newPassword);
    await this.sessions.revokeUser(userId); // invalidate everything after a reset
    this.logger.log(`audit password_reset.completed user=${userId}`);
    return true;
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
