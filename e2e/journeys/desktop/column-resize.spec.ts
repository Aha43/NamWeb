import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #280 — drag-to-resize a column in the Column (Kanban) view, so a wide screen's space goes to the
// column you care about. Width persists per project + column. Desktop-only. Network-mocked.
test.use({
  seedDoc: new DocBuilder()
    .project('proj', 'Project')
    .action('a1', 'Alpha', { under: 'proj' })
    .project('sp1', 'Phase 1', { under: 'proj' })
    .build(),
});

test('drag-resize a column, and the width persists across a reload', async ({ page }) => {
  await page.goto('/projects/proj');
  await page.getByRole('button', { name: 'Column' }).click(); // switch to the Kanban view

  const handle = page.getByRole('separator', { name: 'Resize Unsorted column' });
  await expect(handle).toHaveAttribute('aria-valuenow', '256'); // default width

  // Drag the handle 80px to the right → the column widens by 80.
  const box = await handle.boundingBox();
  if (!box) throw new Error('no resize handle');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(handle).toHaveAttribute('aria-valuenow', '336');

  // Persisted: reload, re-enter Column view, the width is remembered.
  await page.reload();
  await page.getByRole('button', { name: 'Column' }).click();
  await expect(page.getByRole('separator', { name: 'Resize Unsorted column' })).toHaveAttribute(
    'aria-valuenow',
    '336',
  );
});
