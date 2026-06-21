import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';
import { expandWorkbench } from '../../helpers/workbench';

// #79 (Workspace parity, phase 1) — hand-order a project's direct actions and its sub-projects in
// the workbench. Reorders the parent's childIds (the structural order shared with desktop).
test.use({
  seedDoc: new DocBuilder()
    .project('proj', 'Project')
    .action('a1', 'Alpha', { under: 'proj' })
    .action('a2', 'Beta', { under: 'proj' })
    .project('sp1', 'Phase 1', { under: 'proj' })
    .project('sp2', 'Phase 2', { under: 'proj' })
    .build(),
});

test('reorder actions and sub-projects in the workbench, persisted to childIds', async ({ page, doc }) => {
  await page.goto('/projects/proj');
  await expandWorkbench(page);

  const actions = page.getByRole('list').first().getByRole('listitem');
  const subs = page.getByRole('list').nth(1).getByRole('listitem');
  await expect(actions).toHaveText([/Alpha/, /Beta/]);
  await expect(subs).toHaveText([/Phase 1/, /Phase 2/]);

  // Move the first action down.
  await page.getByRole('button', { name: 'Move Alpha down' }).click();
  await expect(actions).toHaveText([/Beta/, /Alpha/]);
  await expect.poll(() => doc.current().nodes['proj'].childIds).toEqual(['a2', 'a1', 'sp1', 'sp2']);

  // Move the first sub-project down.
  await page.getByRole('button', { name: 'Move Phase 1 down' }).click();
  await expect(subs).toHaveText([/Phase 2/, /Phase 1/]);
  await expect.poll(() => doc.current().nodes['proj'].childIds).toEqual(['a2', 'a1', 'sp2', 'sp1']);
});
