import { defineConfig, devices } from '@playwright/test';
import { E2E, STORAGE_STATE } from './e2e/env';

// E2E config: boots Vite on a dedicated port against the isolated `e2e` workspace row,
// signs in once (setup project → storageState), then runs the specs in Chromium and
// WebKit (the iOS Safari proxy for our mobile-first target).
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
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: STORAGE_STATE },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'], storageState: STORAGE_STATE },
      dependencies: ['setup'],
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
