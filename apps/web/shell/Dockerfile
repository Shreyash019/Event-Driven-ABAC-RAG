# Next.js shell (Multi-Zones host). Build context = repo root (pnpm workspace).
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app
# Next bakes rewrites() destinations at BUILD time, so the remote URL must be
# present now (runtime env is ignored). Defaults to the compose service DNS name.
ARG SEARCH_MFE_URL=http://search-mfe:3001
ENV SEARCH_MFE_URL=$SEARCH_MFE_URL
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter shell build

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# standalone bundle is rooted at the monorepo (outputFileTracingRoot)
COPY --from=build /app/apps/web/shell/.next/standalone ./
COPY --from=build /app/apps/web/shell/.next/static ./apps/web/shell/.next/static
COPY --from=build /app/apps/web/shell/public ./apps/web/shell/public
EXPOSE 3000
CMD ["node", "apps/web/shell/server.js"]
