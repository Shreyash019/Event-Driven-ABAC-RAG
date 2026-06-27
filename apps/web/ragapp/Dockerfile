# Next.js ragapp (Multi-Zones remote — RAG/LLM/AI). Build context = repo root.
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter ragapp build

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001 \
    HOSTNAME=0.0.0.0
COPY --from=build /app/apps/web/ragapp/.next/standalone ./
COPY --from=build /app/apps/web/ragapp/.next/static ./apps/web/ragapp/.next/static
COPY --from=build /app/apps/web/ragapp/public ./apps/web/ragapp/public
EXPOSE 3001
CMD ["node", "apps/web/ragapp/server.js"]
