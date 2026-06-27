# 🛡️ Secure Event-Driven Enterprise RAG

A decoupled, polyglot Retrieval-Augmented Generation (RAG) pipeline built to tackle the two biggest bottlenecks in enterprise AI: **data leakage** and **hallucinations**.

Standard RAG apps are prone to cross-departmental data leaks and AI hallucinations. This project demonstrates a **zero-trust architecture** using Attribute-Based Access Control (ABAC) and asynchronous event streaming.

## Key Features

- **Polyglot microservices** — Nest.js for authentication, Go for RAG orchestration + LLM generation (high concurrency), Python for ingestion + retrieval (ML/embeddings). Additional services (notification, analytics, …) slot in per workload behind a shared API gateway.
- **Zero data bleed (ABAC)** — access control is enforced at the vector-database level. A "Finance" user's query mathematically excludes "HR"/"Confidential" documents *before* semantic search runs.
- **Asynchronous ingestion** — Redis as a message broker; document indexing runs in the background so ML work never blocks the API thread.
- **Anti-hallucination retrieval** — hybrid search (dense + sparse) with citation-backed, strictly grounded LLM responses.

## Architecture

| Layer | Technology | Service |
| --- | --- | --- |
| API Gateway (authN, routing, rate-limit) | KrakenD (off-the-shelf) | `gateway` |
| Authentication (login, tokens, users) | Nest.js (TypeScript) | `auth-service` |
| RAG orchestration + LLM generation | Go | `rag-gateway-service` |
| Ingestion + Retrieval | Python 3.11 · LangChain · HuggingFace | `ingestion-retrieval-service` |
| Microfrontends | Next.js (Multi-Zones: host + remotes) | `mainapp`, `ragapp` |
| Notification, Analytics, … | TBD (per workload) | _future_ |
| Vector Database | Qdrant | — |
| Message Broker | Redis | — |
| LLM Generation | OpenAI API (strictly grounded) | — |

**Request flow:** Next.js → `gateway` (validates JWT, injects verified identity claims as trusted headers, routes) → service. For a query: `gateway` → `rag-gateway-service` (builds the ABAC security matrix from verified claims, orchestrates + calls the LLM) → `ingestion-retrieval-service` (hybrid search over Qdrant, ABAC filter applied at the DB level). `auth-service` issues/refreshes tokens. Ingestion is asynchronous: document events go to Redis and `ingestion-retrieval-service` consumes them in the background.

> **Security boundary:** the gateway strips any client-supplied identity headers and injects only server-verified claims — access scope is never taken from the client (see `loc-doc/GUARDRAILS.md` §1.3).

The monorepo is orchestrated with **Nx** (task graph + caching), using each language's native workspace tooling underneath: **pnpm** (JS/TS), **uv** (Python), and **go.work** (Go).

## Repository Layout

```
apps/
  services/        # backend microservices (gateway, auth-service, rag-gateway-service, ingestion-retrieval-service, …)
  web/             # Next.js microfrontends (mainapp host + ragapp remote)
packages/
  ts/              # shared TS libs (@arac/types, @arac/ui, @arac/config)
  contracts/       # cross-language API contracts (OpenAPI)
  py/ · go/        # per-language shared libraries
infra/             # docker-compose, base Dockerfiles, CI templates
```

## Prerequisites

- [Node.js](https://nodejs.org) (LTS) + [pnpm](https://pnpm.io) — `corepack enable`
- [uv](https://docs.astral.sh/uv/) (Python 3.11)
- [Go](https://go.dev/dl/) 1.22+
- [Docker](https://www.docker.com/) (for Qdrant + Redis)

## Getting Started

```bash
# 1. Clone
git clone https://github.com/you/Event-Driven-ARAC-RAG.git
cd Event-Driven-ARAC-RAG

# 2. Install JS/TS dependencies
pnpm install

# 3. Sync Python and Go workspaces
uv sync
go work sync

# 4. Start local infrastructure (Qdrant + Redis)
docker compose -f infra/compose/docker-compose.yml up -d

# 5. Configure environment
cp .env.example .env   # then fill in OPENAI_API_KEY and service settings
```

## Common Commands

```bash
pnpm nx graph                 # visualize the project graph
pnpm nx run-many -t build     # build all projects
pnpm nx run-many -t test      # test all projects
pnpm nx run <project>:serve   # run a single service/app
```

---

> **Status:** Proof of Concept — a demonstration of modern, secure, event-driven AI infrastructure patterns.
