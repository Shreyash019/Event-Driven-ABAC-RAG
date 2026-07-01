import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  type CryptoKey,
  type JWK,
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  importPKCS8,
  importSPKI,
  jwtVerify,
} from 'jose';
import type { JwtConfig } from '../config/configuration';

/** DI token for the JWT slice of AppConfig (wired in app.module later). */
export const JWT_CONFIG = Symbol('JWT_CONFIG');

const ALG = 'RS256';

/**
 * The ABAC identity that gets signed into every access token. These four claims are
 * the ONLY source of access scope downstream (GUARDRAILS §1.3): the gateway propagates
 * them as X-Identity-* headers and rag-gateway-service builds the Qdrant filter from
 * them. `clearance` is a numeric level; defaults must shrink scope, never widen (§1.5).
 */
export interface AbacIdentity {
  sub: string;
  tenant: string;
  /** Department slugs, already expanded with descendants for managed departments. */
  departments: string[];
  clearance: number;
  /** Company-wide seniority level (CompanyLevel); gates document `minLevel` downstream. */
  level: number;
  /** Need-to-know compartment tags the user holds. */
  compartments: string[];
}

/** Verified access-token payload: the ABAC identity plus standard JWT registered claims. */
export interface VerifiedAccessToken extends AbacIdentity {
  jti: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

export interface IssuedAccessToken {
  token: string;
  /** Unix seconds at which the token expires. */
  expiresAt: number;
  jti: string;
}

/**
 * Signs and verifies RS256 access tokens, and exposes the public key as a JWK for the
 * JWKS endpoint (loc-doc/AuthService.md §3.1/§3.4). Key material is imported once and
 * memoized. This service ONLY handles access tokens — refresh tokens are opaque and
 * live in the session store (Phase D), never signed here.
 */
@Injectable()
export class TokenService {
  private privateKeyPromise?: Promise<CryptoKey>;
  private jwksPromise?: Promise<JWK[]>;
  private keySetPromise?: Promise<ReturnType<typeof createLocalJWKSet>>;

  constructor(@Inject(JWT_CONFIG) private readonly config: JwtConfig) {}

  /** Mint a short-lived access JWT for the given verified identity. */
  async signAccessToken(identity: AbacIdentity): Promise<IssuedAccessToken> {
    const jti = randomUUID();
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + this.config.accessTtlSeconds;

    const token = await new SignJWT({
      tenant: identity.tenant,
      departments: identity.departments,
      clearance: identity.clearance,
      level: identity.level,
      compartments: identity.compartments,
    })
      .setProtectedHeader({ alg: ALG, kid: this.config.kid })
      .setSubject(identity.sub)
      .setIssuer(this.config.issuer)
      .setAudience(this.config.audience)
      .setIssuedAt(issuedAt)
      .setExpirationTime(expiresAt)
      .setJti(jti)
      .sign(await this.getPrivateKey());

    return { token, expiresAt, jti };
  }

  /**
   * Verify an access token's signature, issuer, and audience. Throws (jose) on any
   * invalid/expired/tampered token — callers MUST treat a throw as "deny" (fail-closed,
   * GUARDRAILS §1.4) and never fall back to an unscoped identity.
   */
  async verifyAccessToken(token: string): Promise<VerifiedAccessToken> {
    const { payload } = await jwtVerify(token, await this.getKeySet(), {
      algorithms: [ALG],
      issuer: this.config.issuer,
      audience: this.config.audience,
    });

    const clearance = payload.clearance;
    const level = payload.level;
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.tenant !== 'string' ||
      !Array.isArray(payload.departments) ||
      !Array.isArray(payload.compartments) ||
      typeof clearance !== 'number' ||
      typeof level !== 'number'
    ) {
      // A signed-but-malformed token must not yield a usable identity.
      throw new Error('access token is missing required ABAC claims');
    }

    return {
      sub: payload.sub,
      tenant: payload.tenant,
      departments: payload.departments as string[],
      clearance,
      level,
      compartments: payload.compartments as string[],
      jti: payload.jti as string,
      iat: payload.iat as number,
      exp: payload.exp as number,
      iss: payload.iss as string,
      aud: payload.aud as string,
    };
  }

  /** All public keys as JWKs (active + rotation overlap) for GET /.well-known/jwks.json. */
  async getPublicJwks(): Promise<JWK[]> {
    return this.getJwks();
  }

  private getPrivateKey(): Promise<CryptoKey> {
    this.privateKeyPromise ??= importPKCS8(this.config.privateKey, ALG);
    return this.privateKeyPromise;
  }

  /** Build the published JWK set: active signing key first, then verify-only keys. */
  private getJwks(): Promise<JWK[]> {
    this.jwksPromise ??= (async () => {
      const toJwk = async (pem: string, kid: string): Promise<JWK> => ({
        ...(await exportJWK(await importSPKI(pem, ALG))),
        kid,
        alg: ALG,
        use: 'sig',
      });
      const active = await toJwk(this.config.publicKey, this.config.kid);
      const extra = await Promise.all(
        this.config.additionalVerifyKeys.map((k) => toJwk(k.publicKey, k.kid)),
      );
      return [active, ...extra];
    })();
    return this.jwksPromise;
  }

  /** A local JWK set resolver — jwtVerify selects the key by the token's `kid`. */
  private getKeySet(): Promise<ReturnType<typeof createLocalJWKSet>> {
    this.keySetPromise ??= this.getJwks().then((keys) =>
      createLocalJWKSet({ keys }),
    );
    return this.keySetPromise;
  }
}
