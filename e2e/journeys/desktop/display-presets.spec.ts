import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #958 — Display presets: cap the central content width and set the page's vertical density, chosen
// in Preferences, applied live to the shell, persisted per device.
test.use({ seedDoc: new DocBuilder().project('vac', 'Vacation').build() });

test('content-width and density presets apply live and persist', async ({ page }) => {
  await page.goto('/account?tab=preferences');
  const content = page.locator('main > div').first(); // the capped content wrapper
  const main = page.locator('main');

  // Defaults: comfortable width (max-w-6xl = 1152px) + comfortable density (py-8 = 32px).
  await expect(content).toHaveCSS('max-width', '1152px');
  await expect(main).toHaveCSS('padding-top', '32px');

  // Full width drops the cap; Compact density tightens the vertical padding — both live.
  await page.getByRole('button', { name: 'Full' }).click();
  await expect(content).toHaveCSS('max-width', 'none');
  await page.getByRole('button', { name: 'Compact' }).click();
  await expect(main).toHaveCSS('padding-top', '8px'); // py-2

  // Persists across a reload.
  await page.reload();
  await expect(page.locator('main > div').first()).toHaveCSS('max-width', 'none');
  await expect(page.locator('main')).toHaveCSS('padding-top', '8px');
});
