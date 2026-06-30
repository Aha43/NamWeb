import { defineConfig, devices } from '@playwright/test';
import { E2E, MOCK_STORAGE_STATE, STORAGE_STATE } from './e2e/env';

// E2E config. Two suites share one Vite dev server (booted on a dedicated port):
//
//  • Real-backend smoke (smoke.spec.ts) — Chromium + WebKit against the LOCAL Supabase stack.
//    Proves the live wire (routing + Supabase contract). Needs `make supabase-start`.
//  • Network-mocked journeys (e2e/journeys/**) — the Supabase HTTP calls are intercepted
//    (no backend), run fast + deterministically across a desktop and a phone viewport. These
//    are the PR-gating breadth suite (#61).
//
// Each suite has its own one-time auth setup → storageState. Projects are scoped via testMatch
// so the mocked journeys never hit the real backend and the smoke never loads the mocks.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'html' : 'list',
  use: {
    baseURL: E2E.baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    // --- Real-backend smoke ---
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      testMatch: /smoke\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      testMatch: /smoke\.spec\.ts/,
      use: { ...devices['Desktop Safari'], storageState: STORAGE_STATE },
      dependencies: ['setup'],
    },

    // --- Network-mocked journeys ---
    { name: 'mocked-setup', testMatch: /mocked\.setup\.ts/ },
    {
      name: 'mocked-desktop',
      testMatch: '**/journeys/desktop/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'], storageState: MOCK_STORAGE_STATE },
      dependencies: ['mocked-setup'],
    },
    {
      name: 'mocked-phone',
      testMatch: '**/journeys/phone/**/*.spec.ts',
      use: { ...devices['iPhone 13'], storageState: MOCK_STORAGE_STATE },
      dependencies: ['mocked-setup'],
    },

    // --- Tutorial screenshot capture (assets, not a test gate; excluded from e2e:mocked) ---
    // Reuses the mocked-journey auth + seed plumbing to drive the curated demo workspace and
    // screenshot it at both form factors. See e2e/tutorials/capture.spec.ts.
    {
      name: 'tutorials-desktop',
      testMatch: '**/tutorials/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'], storageState: MOCK_STORAGE_STATE },
      dependencies: ['mocked-setup'],
    },
    {
      name: 'tutorials-phone',
      testMatch: '**/tutorials/**/*.spec.ts',
      use: { ...devices['iPhone 13'], storageState: MOCK_STORAGE_STATE },
      dependencies: ['mocked-setup'],
    },
  ],
  webServer: {
    // Own port + strictPort so we never reuse a hand-run dev server pointed at `default`.
    command: 'npm run dev -- --port 5174 --strictPort',
    url: E2E.baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { VITE_WORKSPACE_NAME: E2E.workspaceName },
  },
});
