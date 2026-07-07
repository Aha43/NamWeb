import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #412 — the "spurious navigation to Account/Settings" repro: the More sheet slides up UNDER the
// finger, so a rapid second tap at the More button's coordinates lands on whatever row passes
// that spot and navigates. The guard swallows clicks in the sheet's first moments; a deliberate
// tap afterwards still works. Network-mocked.
test.use({ seedDoc: new DocBuilder().action('a1', 'Task', { status: 'NEXT' }).build() });

test('a rapid double-tap on More does not navigate; a deliberate tap still does', async ({ page }) => {
  await page.goto('/inbox');
  const more = page.getByRole('button', { name: 'More' });
  const box = (await more.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  // Impatient double-tap: second tap ~150ms after the first, same spot (pre-fix this landed on
  // a sheet row — observed navigating to /blocked in this viewport; Account/Settings on others).
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(150);
  await page.touchscreen.tap(x, y);
  await page.waitForTimeout(400);
  await expect(page).toHaveURL(/\/inbox$/);
  await expect(page.getByRole('dialog')).toBeVisible(); // the sheet is still open, not misfired

  // After the guard window, rows behave normally.
  await page.getByRole('link', { name: 'Account', exact: true }).click();
  await expect(page).toHaveURL(/\/account$/);
});
