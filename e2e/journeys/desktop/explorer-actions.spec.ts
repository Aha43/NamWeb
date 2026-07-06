import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #657 — the explorer browses actions as files: drilling into a project shows its actions as
// chevron-less leaves (folder/file icons), and Opening an action opens its editor instead of
// navigating. Network-mocked.
test.use({
  seedDoc: new DocBuilder()
    .project('home', 'Home')
    .action('fix', 'Fix the door', { under: 'home', status: 'NEXT' })
    .action('done1', 'Old chore', { under: 'home', status: 'DONE' })
    .action('free', 'Buy tickets', { status: 'NEXT' }) // a free action
    .build(),
});

test('open an action from the explorer; done actions stay hidden', async ({ page }) => {
  await page.goto('/inbox');
  await page.getByRole('button', { name: 'Project explorer' }).click();
  const dialog = page.getByRole('dialog', { name: 'Open project or action' });

  // Free actions are browsable at the root; drilling into Home reveals its open action only.
  await expect(dialog.getByRole('button', { name: 'Buy tickets' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Home', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Fix the door' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Old chore' })).toHaveCount(0); // DONE hidden

  // Opening the action opens its editor — no navigation.
  await dialog.getByRole('button', { name: 'Fix the door' }).click();
  await dialog.getByRole('button', { name: 'Open', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Edit action' });
  await expect(editor).toBeVisible();
  await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('Fix the door');
  await expect(page).toHaveURL(/\/inbox$/);
});
