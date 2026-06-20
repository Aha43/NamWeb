import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #269 — a project is edited on its own workbench (inline Details panel), not in the action dialog.
// The Projects-list "edit details" button drills in with the panel open; a sub-project's edit button
// does the same one level down. Network-mocked.
test.use({
  seedDoc: new DocBuilder()
    .project('proj', 'Kitchen reno')
    .project('sub', 'Plumbing', { under: 'proj' })
    .build(),
});

test('edit a top-level project via the workbench Details panel', async ({ page, doc }) => {
  await page.goto('/projects');

  // The list's edit-details button drills into the workbench with the Details panel open.
  await page.getByRole('button', { name: 'Edit Kitchen reno' }).click();
  await expect(page).toHaveURL(/\/projects\/proj/);

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

test('edit a sub-project from its parent workbench drills in', async ({ page, doc }) => {
  await page.goto('/projects/proj');

  await page.getByRole('button', { name: 'Edit Plumbing' }).click();
  await expect(page).toHaveURL(/\/projects\/sub/);

  await page.getByLabel('Title').fill('Pipework');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect.poll(() => doc.current().nodes['sub'].title).toBe('Pipework');
});
