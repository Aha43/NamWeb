import { test as setup, expect } from '@playwright/test';
import { E2E, STORAGE_STATE } from './env';

// One-time setup project: sign in through the real login form and snapshot the session so
// every spec reuses it. Workspace seeding/isolation is per-test (see e2e/workspace.ts).
setup('authenticate', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email').fill(E2E.email);
  await page.getByLabel('Password').fill(E2E.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // The sidebar only renders once authenticated — proof the session took.
  await expect(page.getByRole('navigation', { name: 'Sidebar' })).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
