# Python ingestion + retrieval worker. Build context = repo root (uv workspace).
# NOTE: installs the ML stack (langchain, sentence-transformers -> torch); this
# image is large and slow to build.
FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim
WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

# Workspace manifests + sources needed to resolve and build members.
COPY pyproject.toml uv.lock ./
COPY packages/py packages/py
COPY apps/services/ingestion-retrieval-service apps/services/ingestion-retrieval-service

RUN uv sync --package ingestion-retrieval-service --no-dev

ENV REDIS_URL=redis://redis:6379
CMD ["uv", "run", "--no-sync", "--package", "ingestion-retrieval-service", \
     "python", "-m", "ingestion_retrieval_service"]
