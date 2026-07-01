import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #518 — the Settings → Preferences language picker switches the app's locale live and persists.
test.use({ seedDoc: new DocBuilder().build() });

test('the language picker switches the app to Norwegian and back, and persists', async ({ page }) => {
  await page.goto('/account?tab=preferences');

  // Starts in English (the picker's own label is translated).
  const picker = page.getByLabel('Language');
  await expect(picker).toBeVisible();

  // Switch to Norwegian → the label flips live and <html lang> updates.
  await picker.selectOption('nb');
  await expect(page.getByLabel('Språk')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'nb');

  // Persists across a reload.
  await page.reload();
  await expect(page.getByLabel('Språk')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'nb');

  // Back to English.
  await page.getByLabel('Språk').selectOption('en');
  await expect(page.getByLabel('Language')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
