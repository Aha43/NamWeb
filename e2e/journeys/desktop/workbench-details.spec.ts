import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';
import { expandWorkbench } from '../../helpers/workbench';

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

  // The Details panel autosaves — text fields commit on blur, there is no Save button. Target the
  // textbox by role so it isn't confused with the adjacent "Copy title"/"Copy description" buttons.
  const title = page.getByRole('textbox', { name: 'Title' });
  await expect(title).toHaveValue('Kitchen reno');
  await title.fill('Kitchen remodel');
  await title.blur();
  const description = page.getByRole('textbox', { name: 'Description' });
  await description.fill('new cabinets');
  await description.blur();

  // The breadcrumb (current project) reflects the new title, and the document is updated.
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).getByText('Kitchen remodel')).toBeVisible();
  await expect.poll(() => doc.current().nodes['proj'].title).toBe('Kitchen remodel');
  await expect.poll(() => doc.current().nodes['proj'].description).toBe('new cabinets');
});

test('edit a sub-project on its own workbench', async ({ page, doc }) => {
  await page.goto('/projects/proj');
  await expandWorkbench(page);

  // Open the sub-project from its parent workbench, then edit it via its Details panel.
  await page.getByRole('button', { name: 'Open Plumbing' }).click();
  await expect(page).toHaveURL(/\/projects\/sub/);
  // Wait for the parent workbench to actually unmount before editing. The URL flips first; under load
  // the parent's panel can still be painted, and a too-eager edit lands on the parent (#444). "Open
  // Plumbing" only exists on the parent (it lists the sub), so its absence means the sub has rendered.
  await expect(page.getByRole('button', { name: 'Open Plumbing' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Details' }).click();
  const title = page.getByRole('textbox', { name: 'Title' });
  await expect(title).toHaveValue('Plumbing'); // the sub's Details panel, not the parent's
  await title.fill('Pipework');
  await title.blur(); // autosave commits on blur — no Save button

  await expect.poll(() => doc.current().nodes['sub'].title).toBe('Pipework');
});

// Note: deleting a project from its Details panel (and the resulting redirect — to the parent for a
// sub-project, to the list for a top-level one, per #330) is covered by workbench-delete-edit.spec.ts.
