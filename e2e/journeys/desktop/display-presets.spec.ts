import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #958 — Display presets: cap the central content width, chosen in Preferences, applied live to the
// shell, persisted per device. (The page-band "density" preset was retired in #1185; row height is
// now the single CompactRowsToggle, covered below.)
test.use({
  seedDoc: new DocBuilder().project('vac', 'Vacation').action('a1', 'Book flights', { status: 'NEXT' }).build(),
});

test('content-width preset applies live and persists', async ({ page }) => {
  await page.goto('/account?tab=preferences');
  const content = page.locator('main > div').first(); // the capped content wrapper

  // Default: comfortable width (max-w-6xl = 1152px).
  await expect(content).toHaveCSS('max-width', '1152px');

  // Full width drops the cap — live.
  await page.getByRole('button', { name: 'Full' }).click();
  await expect(content).toHaveCSS('max-width', 'none');

  // Persists across a reload.
  await page.reload();
  await expect(page.locator('main > div').first()).toHaveCSS('max-width', 'none');
});

test('the compact-rows toggle shortens the rows (padding + controls shrink together) (#1185)', async ({ page }) => {
  const rowSel = () => page.locator('li').filter({ hasText: 'Book flights' }).first();

  await page.goto('/next');
  const before = (await rowSel().boundingBox())!.height;
  await expect(rowSel()).toHaveCSS('padding-top', '8px'); // py-2, comfortable default

  // Flip the in-header Compact rows toggle → the row padding AND its control buttons shrink,
  // so the whole row is shorter.
  await page.getByRole('button', { name: 'Compact rows' }).click();
  await expect(rowSel()).toHaveCSS('padding-top', '2px'); // py-0.5
  const after = (await rowSel().boundingBox())!.height;
  expect(after).toBeLessThan(before); // genuinely shorter, not just less padding
});
