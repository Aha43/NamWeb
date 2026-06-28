import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #454 — advanced project delete: choose to move a non-empty project's contents up instead of
// deleting them, with a working Undo. Deleting a top-level project re-homes actions to Free actions
// and sub-projects to Top level. Network-mocked.
test.use({
  seedDoc: new DocBuilder()
    .project('home', 'Home')
    .action('tidy', 'Tidy up', { under: 'home' })
    .project('bath', 'Bathroom', { under: 'home' })
    .build(),
});

test('delete a top-level project, moving its contents up (then undo restores them)', async ({ page, doc }) => {
  await page.goto('/projects');

  await page.getByRole('button', { name: 'Delete Home' }).click();
  const dialog = page.getByRole('dialog');
  // Defaults keep both (move up); just confirm.
  await dialog.getByRole('button', { name: 'Delete project' }).click();

  // Project gone; its action went to Free actions, its sub-project to Top level.
  await expect.poll(() => doc.current().nodes['home']).toBeUndefined();
  await expect.poll(() => doc.current().nodes[doc.current().nextActionsNodeId].childIds).toContain('tidy');
  await expect.poll(() => doc.current().nodes[doc.current().projectsNodeId].childIds).toContain('bath');

  // Undo puts everything back under the restored project.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => doc.current().nodes['home']?.childIds ?? []).toEqual(
    expect.arrayContaining(['tidy', 'bath']),
  );
  await expect.poll(() => doc.current().nodes[doc.current().nextActionsNodeId].childIds).not.toContain('tidy');
  await expect.poll(() => doc.current().nodes[doc.current().projectsNodeId].childIds).not.toContain('bath');
});
