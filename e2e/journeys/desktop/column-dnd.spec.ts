import { test, expect, type Locator, type Page } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #91 (Workspace parity, phase 6b) — drag actions within and between Kanban columns. Within a
// column reorders childIds; across columns reparents (moveNode) then places at the drop index.
// Desktop-only; within-column buttons + the editor's Move to… stay as fallbacks.
test.use({
  seedDoc: new DocBuilder()
    .project('proj', 'Project')
    .action('a1', 'Alpha', { under: 'proj' })
    .action('a2', 'Beta', { under: 'proj' })
    .project('sp1', 'Phase 1', { under: 'proj' })
    .action('b1', 'Gamma', { under: 'sp1' })
    .project('sp2', 'Phase 2', { under: 'proj' })
    .build(),
});

/** Drag a row by its grip handle and drop it onto a target (a row or a column's add box). */
async function dragHandleOnto(page: Page, handleLabel: string, target: Locator) {
  const handle = page.getByRole('button', { name: handleLabel });
  const from = await handle.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error('could not measure drag source/target');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // Pass the activation distance, then let dnd-kit register the drag has started.
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 12, { steps: 5 });
  await page.waitForTimeout(50);
  // Approach the target, settle, and let collision detection register `over` before releasing.
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.waitForTimeout(100);
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 + 1, { steps: 3 });
  await page.waitForTimeout(100);
  await page.mouse.up();
}

test('drag actions within a column, into another column, and into an empty column', async ({ page, doc }) => {
  await page.goto('/projects/proj');
  await page.getByRole('button', { name: 'Column' }).click();

  const unsorted = page.getByRole('list').first().getByRole('listitem');
  const phase1 = page.getByRole('list').nth(1).getByRole('listitem');
  await expect(unsorted).toHaveText([/Alpha/, /Beta/]);
  await expect(phase1).toHaveText([/Gamma/]);

  // A) Within the Unsorted column: drag Alpha onto Beta → order flips (reorderChildren on proj).
  await dragHandleOnto(page, 'Drag to reorder Alpha', unsorted.filter({ hasText: 'Beta' }));
  await expect(unsorted).toHaveText([/Beta/, /Alpha/]);
  await expect.poll(() => doc.current().nodes['proj'].childIds).toEqual(['a2', 'a1', 'sp1', 'sp2']);

  // B) Across columns: drag Beta onto Gamma in Phase 1 → Beta reparents before Gamma.
  await dragHandleOnto(page, 'Drag to reorder Beta', phase1.filter({ hasText: 'Gamma' }));
  await expect(page.getByRole('list').nth(1).getByRole('listitem')).toHaveText([/Beta/, /Gamma/]);
  await expect.poll(() => doc.current().nodes['sp1'].childIds).toEqual(['a2', 'b1']);
  await expect.poll(() => doc.current().nodes['proj'].childIds).toEqual(['a1', 'sp1', 'sp2']);

  // C) Into the empty Phase 2 column (drop on its header — a large target inside the column's
  // droppable) → Alpha reparents into sp2.
  await dragHandleOnto(page, 'Drag to reorder Alpha', page.getByRole('button', { name: 'Open Phase 2' }));
  await expect.poll(() => doc.current().nodes['sp2'].childIds).toEqual(['a1']);
  await expect.poll(() => doc.current().nodes['proj'].childIds).toEqual(['sp1', 'sp2']);
});
