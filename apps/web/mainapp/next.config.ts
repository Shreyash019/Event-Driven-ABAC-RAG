import path from "node:path";
import type { NextConfig } from "next";

// Multi-Zones host (mainapp). Owns the shell/layout and general app concerns,
// and composes the independently-built `ragapp` remote (all RAG/LLM/AI things)
// under this origin via rewrites, so the browser sees a single app while each
// zone builds and deploys on its own.
//
// We use Next.js Multi-Zones instead of webpack Module Federation
// (@module-federation/nextjs-mf): that plugin supports only Next 12–15 + Pages
// Router, while this repo is on Next 16 + App Router. See apps/web/README.md.
const RAG_APP_URL = process.env.RAG_APP_URL ?? "http://localhost:3015";

const nextConfig: NextConfig = {
  // self-contained server bundle for the Docker runtime stage
  output: "standalone",
  // trace workspace deps from the monorepo root for standalone output
  outputFileTracingRoot: path.join(process.cwd(), "../../.."),
  // @arac/* libs ship raw TS source; let Next compile them.
  transpilePackages: ["@arac/types", "@arac/ui"],
  async rewrites() {
    return [
      { source: "/rag", destination: `${RAG_APP_URL}/rag` },
      { source: "/rag/:path*", destination: `${RAG_APP_URL}/rag/:path*` },
      // remote's namespaced static assets (its _next/* is served from here)
      { source: "/rag-static/:path*", destination: `${RAG_APP_URL}/rag-static/:path*` },
    ];
  },
};

export default nextConfig;
