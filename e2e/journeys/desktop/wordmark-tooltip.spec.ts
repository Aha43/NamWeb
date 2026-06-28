import { test, expect } from '../../mockedTest';

// #469 — the NAM wordmark tooltip carries the version + build, reachable while signed in.
test('the NAM wordmark tooltip shows name + version + build', async ({ page }) => {
  await page.goto('/inbox');
  await page.getByRole('heading', { name: 'NAM', exact: true }).hover();
  await expect(page.getByRole('tooltip')).toContainText(/Next Action Master · v\d+\.\d+\.\d+/);
});
