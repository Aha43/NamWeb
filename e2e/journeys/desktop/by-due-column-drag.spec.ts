import { test, expect, type Locator, type Page } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #502 — cross-column drag (reparent) must stay available while sorted By due (the calendar-board
// gesture: drag a card from one month column to another). Within-column reorder stays off.
test.use({
  seedDoc: new DocBuilder()
    .project('proj', 'Board')
    .project('jun', 'June', { under: 'proj' })
    .action('a1', 'Plant tomatoes', { under: 'jun', dueAt: '2026-06-15' })
    .project('jul', 'July', { under: 'proj' })
    .build(),
});

/** Drag a card by its (hover-revealed) grip handle onto a target locator. */
async function dragHandleOnto(page: Page, handleLabel: string, target: Locator) {
  const handle = page.getByRole('button', { name: handleLabel });
  const from = await handle.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error('could not measure drag source/target');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 12, { steps: 5 });
  await page.waitForTimeout(50);
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.waitForTimeout(50);
  await page.mouse.up();
}

test('drag a card between columns while sorted By due reparents it', async ({ page, doc }) => {
  await page.goto('/projects/proj');
  await page.getByRole('button', { name: 'Column' }).click();
  // Turn on By due (the button shows the current mode — "Manual" → click to sort by due).
  await page.getByRole('button', { name: 'Manual' }).click();
  await expect(page.getByRole('button', { name: 'By due' })).toBeVisible();

  // Drag the card from June onto the July column.
  await dragHandleOnto(page, 'Drag to reorder Plant tomatoes', page.getByRole('button', { name: 'Open July' }));

  await expect.poll(() => doc.current().nodes['jul'].childIds).toContain('a1');
  await expect.poll(() => doc.current().nodes['jun'].childIds).not.toContain('a1');
});
