import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #83 (Workspace parity, phase 3) — edit a project's own metadata, and delete items from the
// workbench via the editor (with a confirm). Network-mocked.
test.use({
  seedDoc: new DocBuilder()
    .project('proj', 'Project')
    .action('a1', 'Buy tiles', { under: 'proj' })
    .project('sp1', 'Plumbing', { under: 'proj' })
    .build(),
});

test('edit a sub-project’s tags via the editor', async ({ page, doc }) => {
  await page.goto('/projects/proj');

  await page.getByRole('button', { name: 'Edit Plumbing' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Edit project')).toBeVisible();
  await dialog.getByLabel('Tags').fill('home');
  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect.poll(() => doc.current().nodes['sp1'].tags).toEqual(['home']);
});

test('delete an action from the workbench via the editor (with confirm)', async ({ page, doc }) => {
  await page.goto('/projects/proj');

  await page.getByRole('button', { name: 'Edit Buy tiles' }).click();
  page.once('dialog', (d) => d.accept()); // window.confirm
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByText('Buy tiles')).toHaveCount(0);
  await expect.poll(() => doc.current().nodes['a1']).toBeUndefined();
});
