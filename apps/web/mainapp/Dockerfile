# Next.js mainapp (Multi-Zones host). Build context = repo root (pnpm workspace).
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app
# Next bakes rewrites() destinations at BUILD time, so the remote URL must be
# present now (runtime env is ignored). Defaults to the compose service DNS name.
ARG RAG_APP_URL=http://ragapp:3001
ENV RAG_APP_URL=$RAG_APP_URL
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter mainapp build

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# standalone bundle is rooted at the monorepo (outputFileTracingRoot)
COPY --from=build /app/apps/web/mainapp/.next/standalone ./
COPY --from=build /app/apps/web/mainapp/.next/static ./apps/web/mainapp/.next/static
COPY --from=build /app/apps/web/mainapp/public ./apps/web/mainapp/public
EXPOSE 3000
CMD ["node", "apps/web/mainapp/server.js"]
