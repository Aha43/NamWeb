import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #472 — the workbench Summary control gets a keyboard shortcut (`s`) and a tooltip naming it.
test.use({
  seedDoc: new DocBuilder().project('proj', 'Project').action('a1', 'Alpha', { under: 'proj' }).build(),
});

test('press s on a workbench opens the Summary dialog', async ({ page }) => {
  await page.goto('/projects/proj');

  // Tooltip names the shortcut.
  await page.getByRole('button', { name: 'Summary' }).hover();
  await expect(page.getByRole('tooltip')).toContainText('Project summary (Markdown) · s');

  // The `s` shortcut opens the dialog.
  await page.keyboard.press('s');
  const dialog = page.getByRole('dialog', { name: /Summary — Project/ });
  await expect(dialog).toBeVisible();

  // #477 — Copy carries a shortcut tooltip, and ⌘/Ctrl+Enter copies & closes.
  await dialog.getByRole('button', { name: /Copy/ }).hover();
  await expect(page.getByRole('tooltip')).toContainText('copies & closes');
  await page.keyboard.press('Control+Enter');
  await expect(dialog).toBeHidden();
});

// #729 — the Markdown can be edited before copying; Regenerate is the undo.
test('edit the summary text, copy the edits, regenerate to undo', async ({ page }) => {
  await page.goto('/projects/proj');
  await expect(page.getByRole('button', { name: 'Summary' })).toBeVisible(); // workbench mounted
  await page.keyboard.press('s');
  const dialog = page.getByRole('dialog', { name: /Summary — Project/ });
  const area = dialog.getByLabel('Project summary (Markdown)');

  await dialog.getByRole('button', { name: 'Edit' }).click();
  await expect(dialog.getByLabel('Done', { exact: true })).toBeDisabled();
  await area.fill('# My own words');

  // ⌘/Ctrl+Enter copies what is shown — the draft.
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.keyboard.press('Control+Enter');
  await expect(dialog).toBeHidden();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('# My own words');

  // Reopening starts fresh from the generated view; Regenerate also restores it mid-edit.
  await page.keyboard.press('s');
  await expect(area).toContainText(/Alpha/);
  await dialog.getByRole('button', { name: 'Edit' }).click();
  await area.fill('scribbles');
  await dialog.getByRole('button', { name: 'Regenerate' }).click();
  await expect(area).toContainText(/Alpha/);
  await expect(dialog.getByLabel('Done', { exact: true })).toBeEnabled();
});
