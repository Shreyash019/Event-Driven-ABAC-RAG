# Web (microfrontends)

Two independently-built Next.js apps composed as microfrontends:

- **`shell`** — host, runs on `:3000`. Single origin the browser talks to.
- **`search-mfe`** — remote, runs on `:3001`. Mounted by the shell under `/search`.

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

- `shell/next.config.ts` rewrites `/search`, `/search/*`, and `/search-static/*`
  to the `search-mfe` origin (`SEARCH_MFE_URL`, default `http://localhost:3001`).
- `search-mfe/next.config.ts` sets `basePath: /search` and
  `assetPrefix: /search-static` so its routes and assets are namespaced and
  don't collide with the host.

Each zone builds, deploys, and scales independently; the browser sees one app.

## Run locally

```bash
pnpm --filter search-mfe dev   # :3001
pnpm --filter shell dev        # :3000  → open http://localhost:3000 and click "Search"
```

## If you later need component-level federation

Multi-Zones composes at the route level. If you need to render a *component*
from a remote at runtime, adopt **Module Federation 2.0** via
`@module-federation/enhanced` (v2) + its runtime `loadRemote()` API, which is
bundler-agnostic and does not depend on the unmaintained Next webpack plugin.
The frontend talks to `gateway` only.
