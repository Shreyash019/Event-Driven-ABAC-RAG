# auth-service

Identity authority for the ARAC platform (Nest.js). Issues RS256 JWTs, exposes JWKS for
the gateway to verify them, manages refresh-token sessions, and owns user accounts + RBAC.
Design rationale lives in [loc-doc/AuthService.md](../../../loc-doc/AuthService.md); security
invariants in [loc-doc/GUARDRAILS.md](../../../loc-doc/GUARDRAILS.md).

## What it does

- **Login / tokens** — verifies credentials (argon2id) and issues a short-lived RS256
  **access JWT** carrying ABAC claims (`sub`, `tenant`, `department`, `clearance`) plus a
  long-lived **refresh token**. Both are delivered as **httpOnly cookies only** — never in
  a response body (XSS-resistant; the body returns just the `SessionUser`).
- **JWKS** — `GET /.well-known/jwks.json` publishes the public key(s); the KrakenD gateway
  fetches it to validate every token without calling back.
- **Refresh rotation + reuse detection** — each refresh rotates within a session "family";
  replaying a retired token revokes the whole family (theft tripwire).
- **Accounts** — admin-seeded + public self-signup (forced zero scope until granted),
  change-password.
- **RBAC** — DB-managed, tenant/department-scoped roles & permissions (separate from the
  ABAC data axis). Admin endpoints to list users and grant attributes.

## Architecture

| Concern | Choice |
|---|---|
| User store (system of record) | **PostgreSQL** via Prisma |
| Refresh sessions | **dedicated Redis** (TTL-native, replica-shared) — *not* the ingestion broker |
| Password hashing | argon2id (`@node-rs/argon2`) |
| Tokens | RS256 JWT (`jose`), JWKS-verifiable |
| Delivery | httpOnly cookies (`arac_session`, `arac_refresh`) — BFF pattern |

Authentication state never leaves the server as a readable token; the Next.js apps act as a
BFF and the gateway is the trust boundary.

## API (behind the gateway as `/api/auth/*`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `POST` | `/auth/login` | public | Verify credentials → cookies + `SessionUser` |
| `POST` | `/auth/signup` | public | Self-register (forced minimal scope), auto-login |
| `POST` | `/auth/refresh` | refresh cookie | Rotate refresh, mint new access (reuse ⇒ revoke family) |
| `POST` | `/auth/change-password` | access token | Verify current → set new → revoke all sessions |
| `POST` | `/auth/logout` · `/auth/logout-all` | cookie / access | Revoke current family / all sessions |
| `GET`  | `/auth/me` | access token | Current `SessionUser` (SSR) |
| `GET`  | `/auth/users` | `users:read` | List users in caller's scope |
| `POST` | `/auth/users/:id/grant` | `users:grant` | Set a user's tenant/department/clearance |
| `GET`  | `/.well-known/jwks.json` | internal | Public signing keys (gateway source) |
| `GET`  | `/healthz` | internal | Liveness |

Full route table + auth model: [loc-doc/AuthService.md](../../../loc-doc/AuthService.md) §5.

## Configuration

Copy `.env.example` → `.env` (git-ignored) and fill it in. Required: `JWT_ISSUER`,
`JWT_AUDIENCE`, `JWT_KID`, `JWT_PRIVATE_KEY` (RS256 PEM/base64), `DATABASE_URL`,
`AUTH_REDIS_URL`, and `SEED_*` passwords. The service **fails to boot** if a required
secret is missing or, in production, if a seed user falls back to the dev password.

Generate a keypair:
```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out jwt_private.pem
JWT_PRIVATE_KEY=$(base64 -i jwt_private.pem)
```

## Run

```bash
# Local dev (compiles + watches)
pnpm --filter auth-service start:dev   # needs Postgres + Redis reachable per .env

# Full stack (recommended) — brings up Postgres, Redis, gateway, and this service
docker compose -f infra/compose/docker-compose.yml up -d --build auth-service
```

The container runs `prisma migrate deploy` + an idempotent seed before starting. With
`API_DOCS_ENABLED=true`, Swagger is at `/docs`.

### Seeded users (dev)
| Email | Role / scope | Password env |
|---|---|---|
| `admin@acme.test` | super-admin (global) | `SEED_ADMIN_PASSWORD` |
| `finance@acme.test` | user · acme/finance · clearance 3 | `SEED_FINANCE_PASSWORD` |
| `hr@acme.test` | user · acme/hr · clearance 2 | `SEED_HR_PASSWORD` |

## Test

```bash
pnpm --filter auth-service test       # unit
pnpm --filter auth-service test:e2e   # e2e
```
