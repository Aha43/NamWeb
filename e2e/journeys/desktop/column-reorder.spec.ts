import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #93 — reorder the Column/Kanban view's columns (the sub-projects) with left/right buttons (no
// drag, by preference). The Unsorted column is fixed first; moving a column reorders the project's
// childIds (the sub-project order), reusing the same intent as the List view's up/down buttons.
test.use({
  seedDoc: new DocBuilder()
    .project('proj', 'Project')
    .action('a1', 'Solo', { under: 'proj' })
    .project('sp1', 'Phase 1', { under: 'proj' })
    .project('sp2', 'Phase 2', { under: 'proj' })
    .project('sp3', 'Phase 3', { under: 'proj' })
    .build(),
});

test('reorder columns with left/right buttons, persisted to childIds', async ({ page, doc }) => {
  await page.goto('/projects/proj');
  await page.getByRole('button', { name: 'Column' }).click();

  const headers = page.getByRole('button', { name: /^Open Phase/ });
  await expect(headers).toHaveText([/Phase 1/, /Phase 2/, /Phase 3/]);

  // The Unsorted column is fixed: no move buttons, and Phase 1 can't move further left.
  await expect(page.getByRole('button', { name: /Move Project (left|right)/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Move Phase 1 left' })).toBeDisabled();

  // Move Phase 1 right → swaps with Phase 2 (the Unsorted/actions slot stays put in childIds).
  await page.getByRole('button', { name: 'Move Phase 1 right' }).click();
  await expect(headers).toHaveText([/Phase 2/, /Phase 1/, /Phase 3/]);
  await expect.poll(() => doc.current().nodes['proj'].childIds).toEqual(['a1', 'sp2', 'sp1', 'sp3']);

  // Move Phase 3 left → swaps with Phase 1.
  await page.getByRole('button', { name: 'Move Phase 3 left' }).click();
  await expect(headers).toHaveText([/Phase 2/, /Phase 3/, /Phase 1/]);
  await expect.poll(() => doc.current().nodes['proj'].childIds).toEqual(['a1', 'sp2', 'sp3', 'sp1']);
});
