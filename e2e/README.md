# E2E tests (Playwright)

Browser-level smoke against the **real local Supabase** stack — catches the integration
regressions the jsdom unit tests miss (real routing, real Supabase contract).

## Prerequisites

- **Node 18.19+** (Playwright requirement; the repo otherwise builds on older Node).
- The **local Supabase stack** running (from NamDesktop: `make supabase-start`) with the dev
  test user — defaults match `.env.example` (`test@namdesktop.local` / `namdesktop-local`).
- Browsers installed once: `npx playwright install chromium webkit`.

## Run

```bash
npm run e2e        # headless, Chromium + WebKit
npm run e2e:ui     # Playwright UI mode (time-travel debugging)
```

The config boots its own Vite dev server on port **5174** (separate from the hand-run `npm run
dev` on 5173) so a developer's session is never disturbed.

## Isolation

Tests never touch your real `default` workspace. Each browser project drives its own row
(`e2e-<project>`), reset to an empty document before every test (`e2e/workspace.ts`), and
selected at runtime via the app's `localStorage` workspace override. Overridable via env:
`E2E_EMAIL`, `E2E_PASSWORD`, `E2E_BASE_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.

## Layout

| File | Role |
|------|------|
| `playwright.config.ts` (repo root) | projects (setup → chromium/webkit), `webServer`, `storageState` |
| `auth.setup.ts` | signs in once via the real form, snapshots the session |
| `smoke.spec.ts` | capture → process → Next → mark done |
| `env.ts` / `seed.ts` / `workspace.ts` | config, empty-document seed, per-test reset |
