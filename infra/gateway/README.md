# Gateway (KrakenD)

Off-the-shelf API gateway — the **ABAC trust boundary** (GUARDRAILS §1.3).

## How the trust boundary is enforced

KrakenD forwards **only** the headers listed in each endpoint's `input_headers`
whitelist. `X-Identity-*` is never in that list, so any client-supplied
identity header (`X-Identity-Department`, `…-Clearance`, `…-Tenant`, `…-Subject`)
is **dropped at the edge** — a client cannot spoof identity.

For authenticated routes, `auth/validator` verifies the JWT (issued by
`auth-service`, keys via JWKS) and `propagate_claims` injects the **verified**
claims as trusted `X-Identity-*` headers for downstream services. So identity is
only ever the server-verified claim set, never the raw request.

`rag-gateway-service` derives the ABAC security matrix from these trusted
headers; `ingestion-retrieval-service` applies it as the Qdrant pre-filter.

## Notes / TODO before production

- `disable_jwk_security: true` is set so the JWKS can be fetched over plain HTTP
  in local dev. **Remove it** (serve JWKS over HTTPS) before any real deployment.
- Backends point at `host.docker.internal` so the dockerized gateway can reach
  services running on the host via `nx serve`. Switch to compose service DNS
  names once the services are containerized.
- Ports assumed: `auth-service` :3000, `rag-gateway-service` :8081.

## Run

Brought up by `infra/compose/docker-compose.yml` (the `gateway` service) on
`:8080`. See the repo root `make up`.
