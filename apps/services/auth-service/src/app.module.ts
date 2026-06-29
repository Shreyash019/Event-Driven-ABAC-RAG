import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration, {
  type CookieConfig,
  type JwtConfig,
} from './config/configuration';
import { AuthController, COOKIE_CONFIG } from './auth.controller';
import { AuthService } from './auth/auth.service';
import { JWT_CONFIG, TokenService } from './jwt/token.service';
import { JwksController } from './jwt/jwks.controller';
import { PrismaService } from './db/prisma.service';
import { redisProvider } from './db/redis.provider';
import { IDENTITY_PROVIDER } from './users/user.store';
import { PrismaIdentityProvider } from './users/prisma-identity.provider';
import { REFRESH_TTL_SECONDS, SESSION_STORE } from './sessions/session.store';
import { RedisSessionStore } from './sessions/redis-session.store';
import { RbacService } from './rbac/rbac.service';
import { AdminService } from './admin/admin.service';
import { AdminController } from './admin/admin.controller';
import { MailerService } from './mail/mailer.service';
import { PasswordResetService } from './auth/password-reset.service';
import { OrgService } from './org/org.service';
import { OrgController } from './org/org.controller';

/**
 * Composition root. ConfigModule loads + validates the environment via
 * config/configuration.ts (throws on missing secrets → fail-closed boot). Each slice of
 * AppConfig is bound to a DI token so services depend on plain values/interfaces.
 *
 * The user store is Postgres (PrismaIdentityProvider) and the session store is Redis
 * (RedisSessionStore); both sit behind interface tokens, so swapping them — or going
 * back to the in-memory PoC impls — touches only this file (loc-doc/AuthService.md §3.6).
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    // Per-IP rate limiting (req.ip resolves from X-Forwarded-For via `trust proxy`).
    // Generous default; auth-sensitive routes tighten this with @Throttle.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
  ],
  controllers: [AuthController, JwksController, AdminController, OrgController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    {
      provide: JWT_CONFIG,
      useFactory: (config: ConfigService) => config.getOrThrow<JwtConfig>('jwt'),
      inject: [ConfigService],
    },
    {
      provide: COOKIE_CONFIG,
      useFactory: (config: ConfigService) =>
        config.getOrThrow<CookieConfig>('cookie'),
      inject: [ConfigService],
    },
    {
      provide: REFRESH_TTL_SECONDS,
      useFactory: (config: ConfigService) =>
        config.getOrThrow<JwtConfig>('jwt').refreshTtlSeconds,
      inject: [ConfigService],
    },
    PrismaService,
    redisProvider,
    { provide: IDENTITY_PROVIDER, useClass: PrismaIdentityProvider },
    { provide: SESSION_STORE, useClass: RedisSessionStore },
    TokenService,
    AuthService,
    RbacService,
    AdminService,
    MailerService,
    PasswordResetService,
    OrgService,
  ],
})
export class AppModule {}
