SHELL := /bin/sh

.PHONY: bootstrap dev start stop smoke

bootstrap:
	pnpm bootstrap
dev:
	docker compose up -d postgres
	pnpm install
	AUTHON_RUNTIME_MODE=open-core AUTHON_SELF_HOST_MODE=true pnpm prisma generate
	AUTHON_RUNTIME_MODE=open-core AUTHON_SELF_HOST_MODE=true pnpm db:push
	AUTHON_RUNTIME_MODE=open-core AUTHON_SELF_HOST_MODE=true pnpm dev

start:
	docker compose up --build -d

stop:
	docker compose down

smoke:
	bash scripts/smoke-test.sh
