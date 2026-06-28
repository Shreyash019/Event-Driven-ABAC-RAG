import { createPublicKey } from 'node:crypto';

/**
 * Typed, fail-closed configuration for auth-service.
 *
 * This is the foundational file from loc-doc/AuthService.md §6 (Phase A, step 1).
 * It is intentionally dependency-free (no @nestjs/config yet) so it compiles and is
 * unit-testable on its own; ConfigModule wiring is added when app.module.ts is built.
 *
 * Security posture (GUARDRAILS §1.4, §5.1): the RS256 private key and other secrets
 * come ONLY from the environment. If a required value is missing or malformed, `load()`
 * THROWS — the process must not boot half-configured. Failing to start is the correct
 * fail-closed behavior for an identity authority: better no service than one that signs
 * tokens with the wrong key or a blank scope.
 */

export type CookieSameSite = 'lax' | 'strict' | 'none';

export interface JwtConfig {
  /** `iss` claim — who signed the token. */
  issuer: string;
  /** `aud` claim — who the token is for (the gateway/services). */
  audience: string;
  /** Key id published in JWKS and stamped in each token's header for key selection. */
  kid: string;
  /** RS256 private signing key (PEM, PKCS#8 or PKCS#1). Secret. */
  privateKey: string;
  /** RS256 public key (PEM) used to build JWKS. Derived from the private key if unset. */
  publicKey: string;
  /** Access-token lifetime in seconds (short-lived; never revoked, just expires). */
  accessTtlSeconds: number;
  /** Refresh-token lifetime in seconds (long-lived, rotating, revocable). */
  refreshTtlSeconds: number;
}

export interface CookieConfig {
  /** Cookie domain; undefined → host-only cookie (fine for local dev). */
  domain?: string;
  /** `Secure` flag — MUST be true in production (HTTPS only). */
  secure: boolean;
  /** `SameSite` policy for the auth cookies. */
  sameSite: CookieSameSite;
}

export interface ApiDocsConfig {
  /** When true, mount the OpenAPI/Swagger UI. Off in production unless opted in. */
  enabled: boolean;
  /** Route the docs UI is served at. */
  path: string;
}

export interface DbConfig {
  /** Postgres connection string for the user store (system of record). */
  databaseUrl: string;
  /** Redis connection string for refresh-token sessions — dedicated, NOT the
   *  ingestion broker (GUARDRAILS §3.2). */
  redisUrl: string;
}

export interface AppConfig {
  env: string;
  port: number;
  jwt: JwtConfig;
  cookie: CookieConfig;
  apiDocs: ApiDocsConfig;
  db: DbConfig;
}

/** Collected during parsing so we report every problem at once, not one per boot. */
class ConfigErrors {
  private readonly messages: string[] = [];

  add(message: string): void {
    this.messages.push(message);
  }

  throwIfAny(): void {
    if (this.messages.length > 0) {
      throw new Error(
        `Invalid auth-service configuration:\n  - ${this.messages.join('\n  - ')}`,
      );
    }
  }
}

function requireString(
  env: NodeJS.ProcessEnv,
  key: string,
  errors: ConfigErrors,
): string {
  const value = env[key]?.trim();
  if (!value) {
    errors.add(`${key} is required`);
    return '';
  }
  return value;
}

function optionalInt(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: number,
  errors: ConfigErrors,
): number {
  const raw = env[key]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    errors.add(`${key} must be a positive integer (got "${raw}")`);
    return fallback;
  }
  return parsed;
}

function parseSameSite(
  env: NodeJS.ProcessEnv,
  errors: ConfigErrors,
): CookieSameSite {
  const raw = (env.COOKIE_SAMESITE ?? 'lax').trim().toLowerCase();
  if (raw === 'lax' || raw === 'strict' || raw === 'none') return raw;
  errors.add(`COOKIE_SAMESITE must be one of lax|strict|none (got "${raw}")`);
  return 'lax';
}

/**
 * Accepts a key either as a raw PEM, a PEM with escaped `\n` (common in .env files),
 * or base64-encoded PEM, and normalizes to a real PEM string. Returns '' if absent.
 */
function normalizePem(raw: string | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (trimmed.includes('-----BEGIN')) {
    // Unescape literal "\n" sequences that survive .env / JSON encoding.
    return trimmed.replace(/\\n/g, '\n');
  }
  // Assume base64-encoded PEM.
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
    return decoded.includes('-----BEGIN') ? decoded : '';
  } catch {
    return '';
  }
}

function loadKeys(env: NodeJS.ProcessEnv, errors: ConfigErrors): {
  privateKey: string;
  publicKey: string;
} {
  const privateKey = normalizePem(env.JWT_PRIVATE_KEY);
  if (!privateKey) {
    errors.add(
      'JWT_PRIVATE_KEY is required (RS256 PEM, raw / escaped-newline / base64)',
    );
    return { privateKey: '', publicKey: '' };
  }

  // Prefer an explicitly provided public key; otherwise derive it from the private
  // key so JWKS always matches the signer. A bad private key surfaces here, at boot.
  let publicKey = normalizePem(env.JWT_PUBLIC_KEY);
  if (!publicKey) {
    try {
      publicKey = createPublicKey(privateKey)
        .export({ type: 'spki', format: 'pem' })
        .toString();
    } catch (err) {
      errors.add(
        `JWT_PRIVATE_KEY is not a valid RS256 PEM: ${(err as Error).message}`,
      );
    }
  }

  return { privateKey, publicKey };
}

/**
 * Parse and validate configuration from a given environment (defaults to process.env).
 * THROWS on any missing/invalid required value — call this at startup; do not catch
 * and continue with partial config.
 */
/** Parse a boolean env var; returns `fallback` when unset/blank. */
function parseBool(value: string | undefined, fallback: boolean): boolean {
  const raw = value?.trim().toLowerCase();
  if (!raw) return fallback;
  return raw === 'true' || raw === '1' || raw === 'yes';
}

export function load(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const errors = new ConfigErrors();
  const nodeEnv = env.NODE_ENV?.trim() || 'development';

  const config: AppConfig = {
    env: nodeEnv,
    port: optionalInt(env, 'PORT', 3000, errors),
    jwt: {
      issuer: requireString(env, 'JWT_ISSUER', errors),
      audience: requireString(env, 'JWT_AUDIENCE', errors),
      kid: requireString(env, 'JWT_KID', errors),
      ...loadKeys(env, errors),
      accessTtlSeconds: optionalInt(env, 'ACCESS_TTL_SECONDS', 900, errors), // 15m
      refreshTtlSeconds: optionalInt(
        env,
        'REFRESH_TTL_SECONDS',
        60 * 60 * 24 * 14, // 14d
        errors,
      ),
    },
    cookie: {
      domain: env.COOKIE_DOMAIN?.trim() || undefined,
      secure: (env.COOKIE_SECURE?.trim().toLowerCase() ?? 'true') !== 'false',
      sameSite: parseSameSite(env, errors),
    },
    apiDocs: {
      // Secure default: off in production, on elsewhere. Override with API_DOCS_ENABLED.
      enabled: parseBool(env.API_DOCS_ENABLED, nodeEnv !== 'production'),
      path: env.API_DOCS_PATH?.trim() || 'docs',
    },
    db: {
      databaseUrl: requireString(env, 'DATABASE_URL', errors),
      redisUrl: requireString(env, 'AUTH_REDIS_URL', errors),
    },
  };

  errors.throwIfAny();
  return config;
}

/** Default export is the loader factory (consumable by ConfigModule.forRoot later). */
export default load;
