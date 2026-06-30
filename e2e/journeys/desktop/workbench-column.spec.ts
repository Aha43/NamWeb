import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #81 (Workspace parity, phase 2) — the Column/Kanban workbench view: an Unsorted column for the
// project's own actions + one column per sub-project, with within-column reorder. Desktop-only.
test.use({
  seedDoc: new DocBuilder()
    .project('proj', 'Project')
    .action('a1', 'Alpha', { under: 'proj' })
    .action('a2', 'Beta', { under: 'proj' })
    .project('sp1', 'Phase 1', { under: 'proj' })
    .action('s1', 'Sub-A', { under: 'sp1' })
    .action('s2', 'Sub-B', { under: 'sp1' })
    .build(),
});

test('switch to Column view and reorder within columns', async ({ page, doc }) => {
  await page.goto('/projects/proj');
  await page.getByRole('button', { name: 'Column' }).click();

  const unsorted = page.getByRole('list').first().getByRole('listitem');
  const phase1 = page.getByRole('list').nth(1).getByRole('listitem');
  await expect(unsorted).toHaveText([/Alpha/, /Beta/]);
  await expect(phase1).toHaveText([/Sub-A/, /Sub-B/]);

  // Reorder within the Unsorted column → reorders the project's childIds. The card controls reveal
  // on hover (collapsed/inert at rest, #514), so hover the card before clicking its reorder button.
  await page.getByText('Alpha').locator('xpath=ancestor::li[1]').hover({ position: { x: 8, y: 6 } });
  await page.getByRole('button', { name: 'Move Alpha down' }).click();
  await expect(unsorted).toHaveText([/Beta/, /Alpha/]);
  await expect.poll(() => doc.current().nodes['proj'].childIds).toEqual(['a2', 'a1', 'sp1']);

  // Reorder within the Phase 1 column → reorders that sub-project's childIds.
  await page.getByText('Sub-A').locator('xpath=ancestor::li[1]').hover({ position: { x: 8, y: 6 } });
  await page.getByRole('button', { name: 'Move Sub-A down' }).click();
  await expect(phase1).toHaveText([/Sub-B/, /Sub-A/]);
  await expect.poll(() => doc.current().nodes['sp1'].childIds).toEqual(['s2', 's1']);
});
