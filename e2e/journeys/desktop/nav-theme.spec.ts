import { test, expect } from '../../mockedTest';

// J6 — cross-cutting guardrail: the sidebar navigates every surface, and the dark-mode
// preference round-trips a reload. Cheap to run, catches shell/routing/theme regressions
// across the whole app. Network-mocked (no backend).
test.describe('navigation + theme', () => {
  test('the sidebar navigates across surfaces', async ({ page }) => {
    await page.goto('/inbox');
    const sidebar = page.getByRole('navigation', { name: 'Sidebar' });

    await sidebar.getByRole('link', { name: 'Projects' }).click();
    await expect(page).toHaveURL(/\/projects$/);

    await sidebar.getByRole('link', { name: 'Backlog' }).click();
    await expect(page).toHaveURL(/\/backlog$/);

    // Tags now lives in the toolbar (admin surface), not the sidebar. #284
    await page.getByRole('link', { name: 'Tags' }).click();
    await expect(page).toHaveURL(/\/tags$/);

    await sidebar.getByRole('link', { name: 'Done' }).click();
    await expect(page).toHaveURL(/\/done$/);
  });

  test('dark-mode toggle persists across a reload', async ({ page }) => {
    await page.goto('/inbox');
    const html = page.locator('html');

    // Default is dark (echoing the desktop app).
    await expect(html).toHaveClass(/dark/);

    await page.getByRole('button', { name: 'Toggle theme' }).click();
    await expect(html).not.toHaveClass(/dark/);

    // The choice survives a full reload (persisted to localStorage).
    await page.reload();
    await expect(html).not.toHaveClass(/dark/);
  });
});
