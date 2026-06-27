# Web (microfrontends)

Two independently-built Next.js apps composed as microfrontends:

- **`mainapp`** — host, runs on `:3000`. Single origin the browser talks to; owns
  the shell/layout and general app concerns.
- **`ragapp`** — remote, runs on `:3001`. Owns all **RAG / LLM / AI** surfaces.
  Mounted by the mainapp under `/rag` (separation of concerns).

## Why Multi-Zones instead of Module Federation

The setup plan proposed `@module-federation/nextjs-mf` (webpack Module Federation).
We checked it before adopting and it **fails compatibility**:

| Requirement (nextjs-mf 8.x) | This repo | OK? |
| --- | --- | --- |
| `next: ^12 \|\| ^13 \|\| ^14 \|\| ^15` | Next **16.2.9** | ❌ |
| Pages Router only | App Router | ❌ |
| Webpack (no Turbopack) | App Router defaults | ❌ |

So we use **Next.js Multi-Zones**, the officially-supported microfrontend
pattern for the App Router:

- `mainapp/next.config.ts` rewrites `/rag`, `/rag/*`, and `/rag-static/*`
  to the `ragapp` origin (`RAG_APP_URL`, default `http://localhost:3001`).
- `ragapp/next.config.ts` sets `basePath: /rag` and `assetPrefix: /rag-static`
  so its routes and assets are namespaced and don't collide with the host.

Each zone builds, deploys, and scales independently; the browser sees one app.

> `RAG_APP_URL` is consumed at **build time** (Next bakes rewrite destinations),
> so the Docker image takes it as a build arg — see `mainapp/Dockerfile` and
> `infra/compose/docker-compose.yml`.

## Cross-zone navigation

Use `next/link` **within** a zone, but a plain `<a href>` for any link that
crosses `mainapp` ↔ `ragapp` — crossing zones is a hard navigation, and a plain
anchor also escapes the remote's `basePath`.

## Run locally

```bash
pnpm --filter ragapp dev    # :3001
pnpm --filter mainapp dev   # :3000  → open http://localhost:3000 and click "RAG"
```

## If you later need component-level federation

Multi-Zones composes at the route level. If you need to render a *component*
from a remote at runtime, adopt **Module Federation 2.0** via
`@module-federation/enhanced` (v2) + its runtime `loadRemote()` API, which is
bundler-agnostic and does not depend on the unmaintained Next webpack plugin.
The frontend talks to `gateway` only.
