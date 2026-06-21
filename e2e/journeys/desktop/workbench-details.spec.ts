import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #269 — a project is edited on its own workbench (inline Details panel), not in the action dialog.
// You open a project (from the list, or a sub-project from its parent workbench) and expand the
// Details panel to edit/delete it. Network-mocked.
test.use({
  seedDoc: new DocBuilder()
    .project('proj', 'Kitchen reno')
    .project('sub', 'Plumbing', { under: 'proj' })
    .build(),
});

test('edit a top-level project via the workbench Details panel', async ({ page, doc }) => {
  await page.goto('/projects');

  // Open the project, then expand its Details panel to edit it (no per-row edit button).
  await page.getByRole('button', { name: 'Open Kitchen reno' }).click();
  await expect(page).toHaveURL(/\/projects\/proj/);
  await page.getByRole('button', { name: 'Details' }).click();

  const title = page.getByLabel('Title');
  await expect(title).toHaveValue('Kitchen reno');
  await title.fill('Kitchen remodel');
  await page.getByLabel('Description').fill('new cabinets');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  // The breadcrumb (current project) reflects the new title, and the document is updated.
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).getByText('Kitchen remodel')).toBeVisible();
  await expect.poll(() => doc.current().nodes['proj'].title).toBe('Kitchen remodel');
  await expect.poll(() => doc.current().nodes['proj'].description).toBe('new cabinets');
});

test('edit a sub-project on its own workbench', async ({ page, doc }) => {
  await page.goto('/projects/proj');

  // Open the sub-project from its parent workbench, then edit it via its Details panel.
  await page.getByRole('button', { name: 'Open Plumbing' }).click();
  await expect(page).toHaveURL(/\/projects\/sub/);
  await page.getByRole('button', { name: 'Details' }).click();
  await page.getByLabel('Title').fill('Pipework');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect.poll(() => doc.current().nodes['sub'].title).toBe('Pipework');
});

test('delete a project from its Details panel, then land on the parent', async ({ page, doc }) => {
  await page.goto('/projects/sub'); // open the sub-project's own workbench

  await page.getByRole('button', { name: 'Details' }).click();
  await page.getByRole('button', { name: 'Delete project' }).click(); // arm the inline confirm
  await page.getByRole('button', { name: 'Delete', exact: true }).click(); // confirm

  // Climbs to the parent project's workbench, and the node is gone.
  await expect(page).toHaveURL(/\/projects\/proj/);
  await expect.poll(() => doc.current().nodes['sub']).toBeUndefined();
});
