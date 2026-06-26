# E2E tests (Playwright)

Two complementary suites, sharing one Vite dev server:

1. **Real-backend smoke** (`smoke.spec.ts`) — one happy-path journey against the **real local
   Supabase** stack, in Chromium + WebKit. Proves the live wire (routing + Supabase contract)
   that jsdom unit tests can't. Needs the stack up; **local/occasional**, not in CI.
2. **Network-mocked journeys** (`journeys/**`) — broader user journeys with the Supabase HTTP
   calls **intercepted** (`page.route`, see `mocks/`). No backend → fast, deterministic, and run
   across a **desktop and a phone** viewport. These are the **PR-gating** breadth suite (#61).

## Prerequisites

- **Node 18.19+** (Playwright requirement; the repo otherwise builds on older Node).
- Browsers installed once: `npx playwright install chromium webkit`.
- **Real-backend smoke only:** the **local Supabase stack** running (from NamDesktop:
  `make supabase-start`) with the dev test user — defaults match `.env.example`
  (`test@namdesktop.local` / `namdesktop-local`). The mocked journeys need no backend.

## Run

```bash
npm run e2e        # everything (real smoke + mocked journeys), Chromium + WebKit
npm run e2e:ui     # Playwright UI mode (time-travel debugging)

# Just the mocked journeys (no Supabase needed) — what CI runs:
npx playwright test --project=mocked-desktop --project=mocked-phone
```

The config boots its own Vite dev server on port **5174** (separate from the hand-run `npm run
dev` on 5173) so a developer's session is never disturbed.

## Isolation

Neither suite touches your real `default` workspace.

- **Real smoke:** each browser project drives its own row (`e2e-<project>`), reset to an empty
  document before every test (`workspace.ts`), selected via the app's `localStorage` override.
- **Mocked journeys:** the workspace is an in-memory document served by the route mock and seeded
  per spec (`mocks/docBuilder.ts`); nothing leaves the browser.

Overridable via env: `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_BASE_URL`, `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY`.

## Adding a journey

1. Drop a spec under `journeys/desktop/` (Desktop Chrome) or `journeys/phone/` (iPhone 13).
2. Import `{ test, expect }` from `../../mockedTest` — it auto-installs the auth + REST mocks and
   points the app at the isolated workspace.
3. Seed state with `test.use({ seedDoc: new DocBuilder()… })` (omit for an empty workspace).

To drive failure states, set `test.use({ restOptions: … })`: `failFirstGet` makes the initial
pull fail once (the load-error + Retry path), `alwaysConflict` makes every push conflict (so the
reconcile sync notice — "A newer change from another device was applied here." — surfaces).

No new infrastructure per surface — that's the point of the harness.

## Layout

| File | Role |
|------|------|
| `playwright.config.ts` (repo root) | projects (real smoke + mocked desktop/phone), `webServer`, `storageState` |
| `auth.setup.ts` / `mocked.setup.ts` | one-time sign-in → `storageState` (real / mocked) |
| `smoke.spec.ts` | real-backend smoke: capture → process → Next → mark done |
| `journeys/desktop/**`, `journeys/phone/**` | network-mocked journeys |
| `mockedTest.ts` | fixture: installs mocks, seeds the doc, selects the workspace |
| `mocks/supabase.ts` | `page.route` auth + REST (pull / guarded push) mock |
| `mocks/docBuilder.ts` | declarative workspace-document seeding |
| `env.ts` / `seed.ts` / `workspace.ts` | config, empty-document seed, per-test reset |
