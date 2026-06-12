# NamWeb is an npm project; these targets are thin conveniences over npm,
# matching NamDesktop's make muscle memory.

.PHONY: dev run install test e2e build lint help

help:
	@echo "NamWeb make targets:"
	@echo "  make dev      Ensure Supabase stack (+deps/.env) are up, then launch the UI"
	@echo "  make run      Alias for 'make dev'"
	@echo "  make install  npm install"
	@echo "  make test     npm run test"
	@echo "  make e2e      npm run e2e (Playwright; needs the local Supabase stack up)"
	@echo "  make build    npm run build"
	@echo "  make lint     npm run lint"

# Smart launcher: bring up everything NamWeb needs, then start the dev server.
dev:
	pwsh -NoProfile scripts/dev-up.ps1

run: dev

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
