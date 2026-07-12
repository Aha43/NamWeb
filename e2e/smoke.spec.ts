import { test, expect } from '@playwright/test';
import { resetWorkspace, WORKSPACE_STORAGE_KEY } from './workspace';

// Each project gets its own freshly-seeded workspace row, selected via the app's localStorage
// override before any app code runs — full isolation across Chromium/WebKit and across reruns.
test.beforeEach(async ({ page }, testInfo) => {
  const name = `e2e-${testInfo.project.name}`;
  await resetWorkspace(name);
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [WORKSPACE_STORAGE_KEY, name] as const,
  );
});

// Happy-path smoke against the real local Supabase: capture a thought, process it into a
// Next action, mark it done, and confirm it lands on the Done surface. Real browser, real
// routing, real Supabase contract — the class of regression jsdom unit tests miss.
test('capture → process → next → done', async ({ page }) => {
  const title = 'e2e smoke item';

  // Capture: quick-add into the inbox.
  await page.goto('/inbox');
  await page.getByLabel('Quick add').fill(title);
  await page.getByRole('button', { name: 'Add', exact: true }).click(); // 'Add the Learn NAM…' + the add-position toggle also match loosely
  await expect(page.getByText(title)).toBeVisible();

  // Process: it's one action → do it next.
  await page.getByRole('button', { name: `Process ${title}` }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Process item')).toBeVisible();
  await dialog.getByRole('button', { name: /one action/i }).click();
  await dialog.getByRole('button', { name: 'Do it next' }).click();

  // It leaves the inbox.
  await expect(page.getByText(title)).toHaveCount(0);

  // Next: it shows up; flip its status to Done.
  await page.getByRole('link', { name: 'Next', exact: true }).click();
  await expect(page.getByText(title)).toBeVisible();
  await page.getByRole('button', { name: new RegExp(`Status of ${title}`) }).click();
  await page.getByRole('menuitem', { name: 'Done' }).click();

  // Done: it has landed on the completed surface. (The "Marked … as Done" toast may still be
  // up, so a bare getByText is ambiguous — anchor on the row's edit affordance.)
  await page.getByRole('link', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('button', { name: `Edit ${title}` })).toBeVisible();
});
