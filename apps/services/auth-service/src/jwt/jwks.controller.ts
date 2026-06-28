import { Controller, Get } from '@nestjs/common';
import type { JWK } from 'jose';
import { TokenService } from './token.service';

/**
 * Publishes the public signing key(s) as a JWK Set.
 *
 * The KrakenD gateway fetches this at GET /.well-known/jwks.json (see
 * infra/gateway/krakend.json `jwk_url`) to verify every access token's RS256 signature
 * without calling back into auth-service. Only PUBLIC key material is exposed here — the
 * private key never leaves the process (GUARDRAILS §5.1).
 *
 * When key rotation lands (loc-doc/AuthService.md §3.4) this returns multiple keys with
 * distinct `kid`s during the overlap window so in-flight tokens keep verifying.
 */
@Controller('.well-known')
export class JwksController {
  constructor(private readonly tokenService: TokenService) {}

  @Get('jwks.json')
  async jwks(): Promise<{ keys: JWK[] }> {
    return { keys: [await this.tokenService.getPublicJwk()] };
  }
}
