import { test, expect } from '../../mockedTest';

// #469 — the NAM wordmark tooltip carries the version + build, reachable while signed in.
// #870 — the brand moved from the sidebar top into the toolbar; the version stays one hover away.
test('the NAM wordmark tooltip shows name + version + build', async ({ page }) => {
  await page.goto('/inbox');
  await page.getByText('NAM', { exact: true }).hover();
  await expect(page.getByRole('tooltip')).toContainText(/Next Action Master · v\d+\.\d+\.\d+/);
});
