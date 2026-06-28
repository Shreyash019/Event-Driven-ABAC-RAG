import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  Inject,
  Injectable,
  type OnModuleDestroy,
} from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../db/redis.provider';
import {
  type IssuedRefreshToken,
  REFRESH_TTL_SECONDS,
  type RotationResult,
  type SessionStore,
} from './session.store';

/**
 * Redis-backed SessionStore (replaces InMemorySessionStore). Same rotation + reuse-
 * detection semantics as the in-memory store (loc-doc/AuthService.md §3.2), but shared
 * across replicas and with native TTL expiry.
 *
 * Keys (single logical Redis db dedicated to auth):
 *   refresh:{hash}  → hash { familyId, userId, used }   TTL = refresh lifetime
 *   family:{id}     → set of token hashes in the family  (whole-family revoke)
 *   userfam:{uid}   → set of familyIds for a user        (logout-all)
 *
 * `rotate` runs as a Lua script so check-used → mark-used → mint-successor (or detect-
 * reuse → revoke-family) is atomic; two concurrent refreshes of the same token cannot
 * both succeed. We store only SHA-256 hashes of tokens — a Redis breach yields nothing
 * presentable. (Single-node assumption: scripts build keys from args; for Redis Cluster
 * these would need hash-tags.)
 */

const REFRESH_KEY = 'refresh:';
const FAMILY_KEY = 'family:';
const USERFAM_KEY = 'userfam:';

// Returns: {'invalid'} | {'reuse', userId, familyId} | {'rotated', userId, familyId}
// ARGV[1]=oldHash  ARGV[2]=newHash  ARGV[3]=ttlSeconds
const ROTATE_LUA = `
local oldKey = '${REFRESH_KEY}' .. ARGV[1]
local d = redis.call('HMGET', oldKey, 'familyId', 'userId', 'used')
local familyId, userId, used = d[1], d[2], d[3]
if not familyId then return {'invalid'} end
local famKey = '${FAMILY_KEY}' .. familyId
if used == '1' then
  local members = redis.call('SMEMBERS', famKey)
  for i=1,#members do redis.call('DEL', '${REFRESH_KEY}' .. members[i]) end
  redis.call('DEL', famKey)
  redis.call('SREM', '${USERFAM_KEY}' .. userId, familyId)
  return {'reuse', userId, familyId}
end
redis.call('HSET', oldKey, 'used', '1')
local newKey = '${REFRESH_KEY}' .. ARGV[2]
redis.call('HSET', newKey, 'familyId', familyId, 'userId', userId, 'used', '0')
redis.call('EXPIRE', newKey, ARGV[3])
redis.call('SADD', famKey, ARGV[2])
redis.call('EXPIRE', famKey, ARGV[3])
return {'rotated', userId, familyId}
`;

// Revoke the family that the presented token (ARGV[1]=hash) belongs to. Returns 0/1.
const REVOKE_BY_TOKEN_LUA = `
local d = redis.call('HMGET', '${REFRESH_KEY}' .. ARGV[1], 'familyId', 'userId')
local familyId, userId = d[1], d[2]
if not familyId then return 0 end
local famKey = '${FAMILY_KEY}' .. familyId
local members = redis.call('SMEMBERS', famKey)
for i=1,#members do redis.call('DEL', '${REFRESH_KEY}' .. members[i]) end
redis.call('DEL', famKey)
redis.call('SREM', '${USERFAM_KEY}' .. userId, familyId)
return 1
`;

// Revoke every family for a user (ARGV[1]=userId). Returns family count revoked.
const REVOKE_USER_LUA = `
local userKey = '${USERFAM_KEY}' .. ARGV[1]
local fams = redis.call('SMEMBERS', userKey)
for i=1,#fams do
  local famKey = '${FAMILY_KEY}' .. fams[i]
  local members = redis.call('SMEMBERS', famKey)
  for j=1,#members do redis.call('DEL', '${REFRESH_KEY}' .. members[j]) end
  redis.call('DEL', famKey)
end
redis.call('DEL', userKey)
return #fams
`;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

@Injectable()
export class RedisSessionStore implements SessionStore, OnModuleDestroy {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(REFRESH_TTL_SECONDS) private readonly ttlSeconds: number,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  async createSession(userId: string): Promise<IssuedRefreshToken> {
    const familyId = randomUUID();
    const { token, tokenHash } = this.mintToken();
    const ttl = this.ttlSeconds;

    await this.redis
      .multi()
      .hset(`${REFRESH_KEY}${tokenHash}`, { familyId, userId, used: '0' })
      .expire(`${REFRESH_KEY}${tokenHash}`, ttl)
      .sadd(`${FAMILY_KEY}${familyId}`, tokenHash)
      .expire(`${FAMILY_KEY}${familyId}`, ttl)
      .sadd(`${USERFAM_KEY}${userId}`, familyId)
      .expire(`${USERFAM_KEY}${userId}`, ttl)
      .exec();

    return { token, familyId, expiresAt: nowSeconds() + ttl };
  }

  async rotate(presentedToken: string): Promise<RotationResult> {
    const { token: newToken, tokenHash: newHash } = this.mintToken();
    const result = (await this.redis.eval(
      ROTATE_LUA,
      0,
      sha256(presentedToken),
      newHash,
      String(this.ttlSeconds),
    )) as [string, string?, string?];

    const [status, userId, familyId] = result;
    if (status === 'reuse') {
      return { status: 'reuse_detected', userId: userId!, familyId: familyId! };
    }
    if (status === 'rotated') {
      return {
        status: 'rotated',
        userId: userId!,
        familyId: familyId!,
        refresh: {
          token: newToken,
          familyId: familyId!,
          expiresAt: nowSeconds() + this.ttlSeconds,
        },
      };
    }
    return { status: 'invalid' };
  }

  async revoke(presentedToken: string): Promise<void> {
    await this.redis.eval(REVOKE_BY_TOKEN_LUA, 0, sha256(presentedToken));
  }

  async revokeUser(userId: string): Promise<void> {
    await this.redis.eval(REVOKE_USER_LUA, 0, userId);
  }

  private mintToken(): { token: string; tokenHash: string } {
    const token = randomBytes(32).toString('base64url'); // 256-bit opaque secret
    return { token, tokenHash: sha256(token) };
  }
}
