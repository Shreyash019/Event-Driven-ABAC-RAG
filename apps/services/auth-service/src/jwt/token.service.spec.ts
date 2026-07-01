import 'reflect-metadata';
import { generateKeyPairSync } from 'node:crypto';
import { TokenService } from './token.service';
import type { JwtConfig } from '../config/configuration';

/**
 * Unit tests for RS256 token issue/verify. Generates a throwaway keypair per suite. Proves
 * the ABAC claims round-trip and that verification is fail-closed (GUARDRAILS §1.4).
 */
function makeConfig(): JwtConfig {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  return {
    issuer: 'test-iss',
    audience: 'test-aud',
    kid: 'test-kid',
    privateKey,
    publicKey,
    additionalVerifyKeys: [],
    accessTtlSeconds: 900,
    refreshTtlSeconds: 1000,
  };
}

const IDENTITY = {
  sub: 'u1',
  tenant: 'acme',
  departments: ['finance', 'finance.ap'],
  clearance: 3,
  level: 5,
  compartments: ['M&A'],
};

describe('TokenService', () => {
  let svc: TokenService;
  beforeAll(() => {
    svc = new TokenService(makeConfig());
  });

  it('signs and verifies, round-tripping all ABAC claims', async () => {
    const { token } = await svc.signAccessToken(IDENTITY);
    const v = await svc.verifyAccessToken(token);
    expect(v).toMatchObject({ ...IDENTITY, iss: 'test-iss', aud: 'test-aud' });
    expect(v.jti).toBeDefined();
  });

  it('rejects a tampered token (fail-closed)', async () => {
    const { token } = await svc.signAccessToken(IDENTITY);
    await expect(svc.verifyAccessToken(`${token}x`)).rejects.toBeDefined();
  });

  it('rejects a token signed by a different key', async () => {
    const other = new TokenService(makeConfig());
    const { token } = await other.signAccessToken(IDENTITY);
    await expect(svc.verifyAccessToken(token)).rejects.toBeDefined();
  });

  it('publishes a JWK set with the active kid', async () => {
    const jwks = await svc.getPublicJwks();
    expect(jwks[0]).toMatchObject({ kid: 'test-kid', alg: 'RS256', use: 'sig' });
  });
});
