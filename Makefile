COMPOSE := docker compose -f infra/compose/docker-compose.yml

# everything except the two Next frontends (those run locally in watch mode)
BACKENDS := qdrant redis gateway auth-service rag-gateway-service ingestion-retrieval-service

.PHONY: up down gen build test lint graph install dev dev-backends

install:        ## install all JS deps + sync Python workspace
	pnpm install
	uv sync

up:             ## build + run the WHOLE stack (infra + services + frontends)
	$(COMPOSE) up -d --build

infra:          ## start only infra (qdrant, redis, gateway)
	$(COMPOSE) up -d qdrant redis gateway

dev-backends:   ## start infra + backends in docker (no frontends)
	$(COMPOSE) up -d $(BACKENDS)

dev: dev-backends  ## hot-reload: backends in docker + frontends locally (mainapp:3000, ragapp:3001)
	-$(COMPOSE) stop mainapp ragapp 2>/dev/null
	pnpm --parallel --filter "./apps/web/*" run dev

down:           ## stop local infra
	$(COMPOSE) down

gen:            ## regenerate contract stubs (Go + Python) from proto
	cd packages/contracts/proto && buf generate

build:          ## build everything via Nx (cached)
	pnpm nx run-many -t build

test:           ## test everything via Nx (cached)
	pnpm nx run-many -t test

lint:           ## lint everything via Nx (cached)
	pnpm nx run-many -t lint

graph:          ## open the Nx project graph
	pnpm nx graph
