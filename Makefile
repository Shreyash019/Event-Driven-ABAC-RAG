COMPOSE := docker compose -f infra/compose/docker-compose.yml

.PHONY: up down gen build test lint graph install

install:        ## install all JS deps + sync Python workspace
	pnpm install
	uv sync

up:             ## start local infra (qdrant, redis, gateway)
	$(COMPOSE) up -d

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
