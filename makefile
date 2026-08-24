# NamWeb is an npm project. This file is the HUMAN's task surface — the one-liners you
# run yourself, especially credentialed / interactive / prod-facing steps the agent
# can't or shouldn't run (e.g. `fly deploy`, which needs your Fly auth and touches the
# live service). Day-to-day code tasks (typecheck/lint/unit tests) mostly flow through
# the agent now; keep this file focused on what a human still needs a one-liner for, and
# add a target whenever there's a recurring "you go do this" step.

.PHONY: dev run docker install test e2e build lint help mcp-deploy mcp-logs mcp-status migrate-resource-ids

help:
	@echo "NamWeb make targets:"
	@echo "  make dev         Ensure Docker + Supabase stack (+deps/.env) are up, then launch the UI"
	@echo "  make run         Alias for 'make dev'"
	@echo "  make docker      Start the Docker daemon in the background (if not already up)"
	@echo "  make install     npm install"
	@echo "  make test        npm run test"
	@echo "  make e2e         npm run e2e (Playwright; needs the local Supabase stack up)"
	@echo "  make build       npm run build"
	@echo "  make lint        npm run lint"
	@echo "  make mcp-deploy  Gated deploy of the MCP server to Fly (mcp typecheck + tests, then fly deploy)"
	@echo "  make mcp-logs    Tail the live MCP server logs (Fly)"
	@echo "  make mcp-status  Show the MCP server machine status (Fly)"
	@echo "  make migrate-resource-ids  One-time #1195 stamp of ids on legacy resources (DRY RUN; APPLY=1 to write)"

# Smart launcher: bring up everything NamWeb needs, then start the dev server.
dev:
	pwsh -NoProfile scripts/dev-up.ps1

run: dev

docker:
	pwsh -NoProfile scripts/docker-up.ps1

install:
	npm install

test:
	npm run test

e2e:
	npm run e2e

build:
	npm run build

lint:
	npm run lint

# --- MCP server ops (Fly) — human-run: these need your Fly auth and touch the live prod service.
# App/config live in fly.toml (app `nam-mcp`); secrets in Fly. See docs/features/remote-mcp/deploy.md.
mcp-deploy:
	npm run mcp:deploy

mcp-logs:
	fly logs -a nam-mcp

mcp-status:
	fly status -a nam-mcp

# One-time resource-id migration (#1195). DRY RUN by default (no write); set APPLY=1 to stamp ids.
# Hits the workspace described by your env (.env by default — point it at prod to migrate prod).
migrate-resource-ids:
	tsx --env-file=.env scripts/migrate-resource-ids.ts
