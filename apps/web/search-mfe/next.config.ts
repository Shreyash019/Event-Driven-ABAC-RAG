import type { NextConfig } from "next";

// Multi-Zones remote (search-mfe). Served standalone on :3001 but mounted by the
// shell host under /search. basePath namespaces all routes; assetPrefix
// namespaces static assets so they don't collide with the host's _next/*.
const nextConfig: NextConfig = {
  basePath: "/search",
  assetPrefix: "/search-static",
  // @arac/* libs ship raw TS source; let Next compile them.
  transpilePackages: ["@arac/types", "@arac/ui"],
};

export default nextConfig;
