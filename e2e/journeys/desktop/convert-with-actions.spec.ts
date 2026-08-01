import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';
import { expandWorkbench } from '../../helpers/workbench';

// #999 — converting an action to a project lets you jot the first actions in the moment (names only).
// Create seeds them under the new project and lands on its workbench. Network-mocked.
test.use({
  seedDoc: new DocBuilder().action('a', 'Plan the trip', { status: 'NEXT' }).build(),
});

test('convert an action to a project, seeding first actions', async ({ page, doc }) => {
  await page.goto('/next');

  await page.getByRole('button', { name: 'Edit Plan the trip' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Move / make project' }).click(); // expand the section
  await dialog.getByRole('button', { name: 'Make project', exact: true }).click();

  // The brain-dump dialog: rename the project (it wants a fresh name), then jot two first actions.
  await page.getByRole('button', { name: 'Rename the project' }).click();
  const nameInput = page.getByRole('textbox', { name: 'Rename Plan the trip' });
  await nameInput.fill('Summer holiday');
  await nameInput.press('Enter');

  const input = page.getByRole('textbox', { name: 'Add an action' });
  await input.fill('Book flights');
  await input.press('Enter');
  await input.fill('Pack bags');
  await input.press('Enter');
  await page.getByRole('button', { name: 'Create project' }).click();

  // Land on the new project's workbench; it carries the fresh name; expand to see its actions.
  await expect(page).toHaveURL(/\/projects\/a$/);
  await expect.poll(() => doc.current().nodes['a'].project).toBe(true);
  await expect.poll(() => doc.current().nodes['a'].title).toBe('Summer holiday');
  await expandWorkbench(page);
  await expect(page.getByText('Book flights')).toBeVisible();
  await expect(page.getByText('Pack bags')).toBeVisible();
  // Seeded as NEXT actions, in typed order (the project's childIds).
  await expect
    .poll(() => doc.current().nodes['a'].childIds.map((cid) => doc.current().nodes[cid]))
    .toMatchObject([
      { title: 'Book flights', status: 'NEXT', project: false },
      { title: 'Pack bags', status: 'NEXT', project: false },
    ]);
});
