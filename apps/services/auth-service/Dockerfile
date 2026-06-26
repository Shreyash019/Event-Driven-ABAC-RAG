# Nest.js auth-service. Build context = repo root (pnpm workspace).
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter auth-service build

FROM node:22-slim AS run
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000
COPY --from=build /app ./
EXPOSE 3000
CMD ["node", "apps/services/auth-service/dist/main.js"]
