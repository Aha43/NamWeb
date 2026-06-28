import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #486 — while a modal dialog is open, app-wide shortcuts (capture, nav chords) are suspended so
// they don't fire behind the modal.
test.use({
  seedDoc: new DocBuilder().project('proj', 'Project').action('a1', 'Alpha', { under: 'proj' }).build(),
});

test('global shortcuts are suspended while a dialog is open', async ({ page }) => {
  await page.goto('/projects/proj');
  await expect(page.getByRole('button', { name: 'Summary' })).toBeVisible();

  // Open the Summary dialog.
  await page.keyboard.press('s');
  const dialog = page.getByRole('dialog', { name: /Summary — Project/ });
  await expect(dialog).toBeVisible();

  // `c` must NOT open Capture over it, and a `g i` chord must NOT navigate away.
  await page.keyboard.press('c');
  await expect(page.getByLabel('Capture to inbox')).toHaveCount(0);
  await page.keyboard.press('g');
  await page.keyboard.press('i');
  await expect(page).toHaveURL(/\/projects\/proj$/);
  await expect(dialog).toBeVisible();

  // Close it — shortcuts work again.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.keyboard.press('c');
  await expect(page.getByLabel('Capture to inbox')).toBeVisible();
});
