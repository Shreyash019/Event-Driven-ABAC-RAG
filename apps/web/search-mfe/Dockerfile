# Next.js search-mfe (Multi-Zones remote). Build context = repo root.
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter search-mfe build

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001 \
    HOSTNAME=0.0.0.0
COPY --from=build /app/apps/web/search-mfe/.next/standalone ./
COPY --from=build /app/apps/web/search-mfe/.next/static ./apps/web/search-mfe/.next/static
COPY --from=build /app/apps/web/search-mfe/public ./apps/web/search-mfe/public
EXPOSE 3001
CMD ["node", "apps/web/search-mfe/server.js"]
