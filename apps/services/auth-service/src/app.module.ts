import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
  imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration] })],
  controllers: [AuthController, JwksController],
  providers: [
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
  ],
})
export class AppModule {}
