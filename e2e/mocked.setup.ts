import { test as setup, expect } from '@playwright/test';
import { E2E, MOCK_STORAGE_STATE } from './env';
import { installAuthMock, installRestMock } from './mocks/supabase';
import { emptyDoc } from './mocks/docBuilder';
import { WORKSPACE_STORAGE_KEY } from './workspace';

// One-time setup for the network-mocked journeys: sign in through the real Login form while
// the GoTrue + REST calls are mocked, then snapshot the (mocked) session so every journey
// reuses it. No backend involved — purely the auth-token round-trip, faked.
setup('mocked authenticate', async ({ page }) => {
  await installAuthMock(page);
  await installRestMock(page, emptyDoc());
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [WORKSPACE_STORAGE_KEY, E2E.workspaceName] as const,
  );

  await page.goto('/');
  await page.getByLabel('Email').fill(E2E.email);
  await page.getByLabel('Password').fill(E2E.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  // The sidebar only renders once authenticated — proof the mocked session took.
  await expect(page.getByRole('navigation', { name: 'Sidebar' })).toBeVisible();

  await page.context().storageState({ path: MOCK_STORAGE_STATE });
});
