# Nest.js auth-service. Build context = repo root (pnpm workspace).
FROM node:22-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
# Generate the Prisma client (pnpm ignores package build scripts, so do it explicitly).
RUN pnpm --filter auth-service exec prisma generate
RUN pnpm --filter auth-service build

FROM node:22-slim AS run
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000
COPY --from=build /app ./
EXPOSE 3000
WORKDIR /app/apps/services/auth-service
# On boot: apply migrations, seed (idempotent upsert), then start. migrate/seed are
# safe to re-run; seed fails closed in prod if SEED_* passwords are unset.
CMD ["sh", "-c", "npx prisma migrate deploy && npx ts-node --compiler-options '{\"module\":\"commonjs\",\"moduleResolution\":\"node\"}' prisma/seed.ts && node dist/main.js"]
