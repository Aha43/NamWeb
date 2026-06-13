import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #87 (Workspace parity, phase 5) — attach a resource (link) to an action via the editor; the row
// then shows a paperclip and the resource persists. Network-mocked.
test.use({
  seedDoc: new DocBuilder().project('proj', 'Project').action('a1', 'Read the spec', { under: 'proj' }).build(),
});

test('add a resource via the editor; the row shows a paperclip', async ({ page, doc }) => {
  await page.goto('/projects/proj');

  await page.getByRole('button', { name: 'Edit Read the spec' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Resource value').fill('https://spec.test');
  await dialog.getByRole('button', { name: 'Add' }).click();
  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByLabel('Has resources')).toBeVisible();
  await expect.poll(() => doc.current().nodes['a1'].resources).toEqual([
    { type: 'URI', value: 'https://spec.test', description: null },
  ]);
});
