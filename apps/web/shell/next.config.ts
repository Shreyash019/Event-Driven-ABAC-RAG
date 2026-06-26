import path from "node:path";
import type { NextConfig } from "next";

// Multi-Zones host (shell). Composes the independently-built `search-mfe` remote
// under this origin via rewrites, so the browser sees a single app while each
// zone builds and deploys on its own.
//
// We use Next.js Multi-Zones instead of webpack Module Federation
// (@module-federation/nextjs-mf): that plugin supports only Next 12–15 + Pages
// Router, while this repo is on Next 16 + App Router. See apps/web/README.md.
const SEARCH_MFE_URL = process.env.SEARCH_MFE_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  // self-contained server bundle for the Docker runtime stage
  output: "standalone",
  // trace workspace deps from the monorepo root for standalone output
  outputFileTracingRoot: path.join(process.cwd(), "../../.."),
  // @arac/* libs ship raw TS source; let Next compile them.
  transpilePackages: ["@arac/types", "@arac/ui"],
  async rewrites() {
    return [
      { source: "/search", destination: `${SEARCH_MFE_URL}/search` },
      { source: "/search/:path*", destination: `${SEARCH_MFE_URL}/search/:path*` },
      // remote's namespaced static assets (its _next/* is served from here)
      { source: "/search-static/:path*", destination: `${SEARCH_MFE_URL}/search-static/:path*` },
    ];
  },
};

export default nextConfig;
