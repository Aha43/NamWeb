import { test, expect } from '../../mockedTest';

// #464 — the Help page footer stamps the release version + build (here "dev", from the dev server).
test('the Help page shows the version badge', async ({ page }) => {
  await page.goto('/help');
  await expect(page.getByText(/NamWeb v\d+\.\d+\.\d+/)).toBeVisible();
});
