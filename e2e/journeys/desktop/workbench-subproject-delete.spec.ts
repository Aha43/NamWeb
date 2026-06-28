import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';
import { expandWorkbench } from '../../helpers/workbench';

// #419/#454 — delete a sub-project from its row via the advanced-delete dialog. Choosing "Delete the
// actions" wipes its contents too; we stay on the parent workbench. Network-mocked.
test.use({
  seedDoc: new DocBuilder()
    .project('proj', 'Project')
    .project('sp1', 'Plumbing', { under: 'proj' })
    .action('s1', 'Fix tap', { under: 'sp1' })
    .build(),
});

test('delete a sub-project (and its contents) from its row via the dialog', async ({ page, doc }) => {
  await page.goto('/projects/proj');
  await expandWorkbench(page);
  await expect(page.getByRole('button', { name: 'Open Plumbing' })).toBeVisible();

  await page.getByRole('button', { name: 'Delete Plumbing' }).click(); // opens the delete dialog
  const dialog = page.getByRole('dialog');
  await dialog.getByText('Delete the actions').click(); // opt to delete its action too
  await dialog.getByRole('button', { name: 'Delete project' }).click(); // confirm

  // The row is gone and the contents were deleted; we stay on the parent workbench.
  await expect(page.getByRole('button', { name: 'Open Plumbing' })).toHaveCount(0);
  await expect.poll(() => doc.current().nodes['sp1']).toBeUndefined();
  await expect.poll(() => doc.current().nodes['s1']).toBeUndefined();
  await expect(page).toHaveURL(/\/projects\/proj$/);
});
