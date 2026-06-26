import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';
import { expandWorkbench } from '../../helpers/workbench';

// #419 — delete a sub-project from its row in the parent project's List view (with confirm),
// recursive when it has descendants, staying on the parent workbench. Network-mocked.
test.use({
  seedDoc: new DocBuilder()
    .project('proj', 'Project')
    .project('sp1', 'Plumbing', { under: 'proj' })
    .action('s1', 'Fix tap', { under: 'sp1' })
    .build(),
});

test('delete a sub-project from its row in the parent workbench (with confirm)', async ({ page, doc }) => {
  await page.goto('/projects/proj');
  await expandWorkbench(page);
  await expect(page.getByRole('button', { name: 'Open Plumbing' })).toBeVisible();

  await page.getByRole('button', { name: 'Delete Plumbing' }).click(); // arm the inline confirm
  await page.getByRole('button', { name: 'Delete', exact: true }).click(); // confirm

  // The row is gone and the subtree is deleted (recursive); we stay on the parent workbench.
  await expect(page.getByRole('button', { name: 'Open Plumbing' })).toHaveCount(0);
  await expect.poll(() => doc.current().nodes['sp1']).toBeUndefined();
  await expect.poll(() => doc.current().nodes['s1']).toBeUndefined();
  await expect(page).toHaveURL(/\/projects\/proj$/);
});
