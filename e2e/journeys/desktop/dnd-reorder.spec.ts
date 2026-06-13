import { test, expect, type Locator, type Page } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #89 (Workspace parity, phase 6a) — drag-and-drop reorder (dnd-kit) on the single-container
// surfaces, reusing the existing intents. Desktop-only; the up/down buttons stay as a fallback.
// These journeys exercise the real pointer-drag path (the unit suite can't simulate dragging).

/** Drag a row by its grip handle and drop it onto another row, so the two swap. */
async function dragHandleOntoRow(page: Page, handleLabel: string, targetRow: Locator) {
  const handle = page.getByRole('button', { name: handleLabel });
  const from = await handle.boundingBox();
  const to = await targetRow.boundingBox();
  if (!from || !to) throw new Error('could not measure drag source/target');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // Nudge past the PointerSensor activation distance, then settle over the target's lower half.
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 10, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height - 4, { steps: 10 });
  // A final settle move so dnd-kit registers `over` before we release (avoids a drop/up race).
  await page.mouse.move(to.x + to.width / 2, to.y + to.height - 3, { steps: 2 });
  await page.mouse.up();
}

test.describe('workbench drag reorder (childIds)', () => {
  test.use({
    seedDoc: new DocBuilder()
      .project('proj', 'Project')
      .action('a1', 'Alpha', { under: 'proj' })
      .action('a2', 'Beta', { under: 'proj' })
      .project('sp1', 'Phase 1', { under: 'proj' })
      .project('sp2', 'Phase 2', { under: 'proj' })
      .build(),
  });

  test('drag a direct action and a sub-project, persisted to childIds', async ({ page, doc }) => {
    await page.goto('/projects/proj');

    const actions = page.getByRole('list').first().getByRole('listitem');
    const subs = page.getByRole('list').nth(1).getByRole('listitem');
    await expect(actions).toHaveText([/Alpha/, /Beta/]);
    await expect(subs).toHaveText([/Phase 1/, /Phase 2/]);

    // Drag Alpha onto Beta → the action order flips; sub-projects keep their childIds slots.
    await dragHandleOntoRow(page, 'Drag to reorder Alpha', actions.nth(1));
    await expect(actions).toHaveText([/Beta/, /Alpha/]);
    await expect.poll(() => doc.current().nodes['proj'].childIds).toEqual(['a2', 'a1', 'sp1', 'sp2']);

    // Drag Phase 1 onto Phase 2 → the sub-project order flips; the actions stay put.
    await dragHandleOntoRow(page, 'Drag to reorder Phase 1', subs.nth(1));
    await expect(subs).toHaveText([/Phase 2/, /Phase 1/]);
    await expect.poll(() => doc.current().nodes['proj'].childIds).toEqual(['a2', 'a1', 'sp2', 'sp1']);
  });
});

test.describe('Next list drag reorder (viewOrders)', () => {
  test.use({
    seedDoc: new DocBuilder().action('n1', 'First').action('n2', 'Second').build(),
  });

  test('drag a Next action, persisted to the view order', async ({ page, doc }) => {
    await page.goto('/next');

    const rows = page.getByRole('list').getByRole('listitem');
    await expect(rows).toHaveText([/First/, /Second/]);

    await dragHandleOntoRow(page, 'Drag to reorder First', rows.nth(1));
    await expect(rows).toHaveText([/Second/, /First/]);
    await expect.poll(() => doc.current().viewOrders['next']).toEqual(['n2', 'n1']);
  });
});
