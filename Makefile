.PHONY: help dev build addon test test-py typecheck db-up db-down install clean

# Default target
help:
	@echo "noodlebin"
	@echo ""
	@echo "  make dev        Start the Next.js dev server"
	@echo "  make build      Production build of the web app"
	@echo "  make addon      Build the Blender extension zip → dist/noodlebin-*.zip"
	@echo "  make install    bun install + uv sync"
	@echo "  make test       Run all JS/TS tests"
	@echo "  make test-py    Run all Python tests (addon + scripts)"
	@echo "  make typecheck  TypeScript typecheck across all packages"
	@echo "  make db-up      Start the local Postgres container"
	@echo "  make db-down    Stop the local Postgres container"
	@echo "  make clean      Remove build output (dist/, .next/)"

# ── Dev ────────────────────────────────────────────────────────────────────────

dev:
	cd apps/web && bun run dev

build:
	cd apps/web && bun run build

# ── Add-on ─────────────────────────────────────────────────────────────────────

addon:
	python3 scripts/build_addon.py

# ── Tests ──────────────────────────────────────────────────────────────────────

test:
	bun test

test-py:
	python3 -m unittest discover -s addon/tests -t . -v
	python3 -m unittest discover -s scripts/tests -t . -v

typecheck:
	bun run --filter '*' typecheck

# ── Database ───────────────────────────────────────────────────────────────────

db-up:
	docker compose up -d --wait

db-down:
	docker compose down

# ── Install ────────────────────────────────────────────────────────────────────

install:
	bun install
	uv sync

# ── Clean ──────────────────────────────────────────────────────────────────────

clean:
	rm -rf apps/web/.next dist/*.zip
