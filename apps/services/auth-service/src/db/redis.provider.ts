import { Logger, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import type { DbConfig } from '../config/configuration';

/**
 * Dedicated Redis connection for refresh-token sessions (loc-doc/AuthService.md §3.6).
 * This is NOT the ingestion-broker Redis — auth session state never shares a datastore
 * with the document pipeline (GUARDRAILS §3.2).
 *
 * Consumers inject the client via REDIS_CLIENT and type it as `Redis` from 'ioredis'.
 * The connection is closed by the session store's onModuleDestroy (it owns the client).
 */
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export const redisProvider: Provider = {
  provide: REDIS_CLIENT,
  useFactory: (config: ConfigService) => {
    const logger = new Logger('Redis');
    const client = new Redis(config.getOrThrow<DbConfig>('db').redisUrl, {
      // Fail fast rather than queue commands forever if Redis is unreachable — an auth
      // path that hangs is worse than one that errors and denies (fail-closed).
      maxRetriesPerRequest: 3,
    });
    client.on('error', (err) => logger.error(`redis error: ${err.message}`));
    client.on('connect', () => logger.log('redis connected'));
    return client;
  },
  inject: [ConfigService],
};
