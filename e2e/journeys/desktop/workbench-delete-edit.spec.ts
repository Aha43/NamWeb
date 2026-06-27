import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';
import { expandWorkbench } from '../../helpers/workbench';

// #83 (Workspace parity, phase 3) — edit a project's own metadata (now via the workbench Details
// panel, #269), and delete actions from the workbench via the editor dialog (with a confirm).
// Network-mocked.
test.use({
  seedDoc: new DocBuilder()
    .project('proj', 'Project')
    .action('a1', 'Buy tiles', { under: 'proj' })
    .project('sp1', 'Plumbing', { under: 'proj' })
    .build(),
});

test('edit a sub-project’s tags via the workbench Details panel', async ({ page, doc }) => {
  await page.goto('/projects/proj');
  await expandWorkbench(page);

  // A sub-project is edited on its own workbench Details panel (#269) — open it, then expand Details.
  await page.getByRole('button', { name: 'Open Plumbing' }).click();
  await expect(page).toHaveURL(/\/projects\/sp1/);
  // Wait for the parent workbench to actually unmount before editing. The URL flips first; under load
  // the parent's panel can still be painted, and a too-eager edit lands on the parent (#444). "Open
  // Plumbing" only exists on the parent (it lists the sub), so its absence means the sub has rendered.
  await expect(page.getByRole('button', { name: 'Open Plumbing' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Details' }).click();
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveValue('Plumbing'); // the sub's panel
  const tags = page.getByLabel('Tags');
  await tags.fill('home');
  await tags.blur(); // the Details panel autosaves — tags commit on blur, there is no Save button

  await expect.poll(() => doc.current().nodes['sp1'].tags).toEqual(['home']);
});

// #330 — deleting a sub-project should return to its PARENT project, not the root /projects list.
test('deleting a sub-project navigates to its parent project', async ({ page }) => {
  await page.goto('/projects/sp1');
  await page.getByRole('button', { name: 'Details' }).click();
  await page.getByRole('button', { name: 'Delete project' }).click(); // arm the confirm
  await page.getByRole('button', { name: 'Delete', exact: true }).click(); // confirm
  await expect(page).toHaveURL(/\/projects\/proj$/); // parent, not /projects
});

test('deleting a top-level project navigates to the Projects list', async ({ page }) => {
  await page.goto('/projects/proj');
  await page.getByRole('button', { name: 'Details' }).click();
  await page.getByRole('button', { name: 'Delete project' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
});

test('delete an action from the workbench via the editor (with confirm)', async ({ page, doc }) => {
  await page.goto('/projects/proj');
  await expandWorkbench(page);

  await page.getByRole('button', { name: 'Edit Buy tiles' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Delete' }).click(); // arm the inline confirm
  await dialog.getByRole('button', { name: 'Delete' }).click(); // confirm

  // The undo toast briefly echoes the deleted title, so assert the row is gone (its edit button)
  // rather than page-wide text, which would also match the toast.
  await expect(page.getByRole('button', { name: 'Edit Buy tiles' })).toHaveCount(0);
  await expect.poll(() => doc.current().nodes['a1']).toBeUndefined();
});
