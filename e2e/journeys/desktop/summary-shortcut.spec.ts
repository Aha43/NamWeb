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
  await expect(page.getByRole('dialog', { name: /Summary — Project/ })).toBeVisible();
});
