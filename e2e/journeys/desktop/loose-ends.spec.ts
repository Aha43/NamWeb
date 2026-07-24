import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #906 — "Loose ends": the always-on status overview. Composes the stalled-projects and gone-quiet
// lenses with drill-in, plus reference counts. DocBuilder stamps nodes at 2026-01-01, so any open
// action reads as "gone quiet"; an empty/next-less project reads as "stalled".
test.use({
  seedDoc: new DocBuilder()
    .project('p', 'Paint the shed') // no next action → stalled (top-level)
    .action('a', 'Fix the gutter') // free NEXT action, old timestamp → gone quiet
    .project('parent', 'Kitchen reno') // healthy parent (has a next)
    .action('pn', 'Measure counters', { under: 'parent', status: 'NEXT' })
    .project('nested', 'Tiling', { under: 'parent' }) // stalled sub-project → shown with its path
    // A single action blocked by TWO prerequisites — the Blocked count must still say 1, not 2 (#915).
    .action('b1', 'Prereq one', { status: 'BACKLOG' })
    .action('b2', 'Prereq two', { status: 'BACKLOG' })
    .action('blk', 'Waiting on two things', { status: 'NEXT', blockedBy: ['b1', 'b2'] })
    .inbox('i', 'A raw capture') // reference count: Inbox 1
    .build(),
});

test('Loose ends surfaces stalled projects + gone-quiet actions, with reference counts and drill-in', async ({ page }) => {
  await page.goto('/loose-ends');
  await expect(page.getByRole('heading', { name: 'Loose ends' })).toBeVisible();

  // Stalled: the next-less project is listed.
  await expect(page.getByRole('heading', { name: /Stalled projects/ })).toBeVisible();
  const stalled = page.getByRole('button', { name: 'Open Paint the shed' });
  await expect(stalled).toBeVisible();

  // Gone quiet: the old open action is listed.
  await expect(page.getByRole('heading', { name: /Gone quiet/ })).toBeVisible();
  await expect(page.getByText('Fix the gutter')).toBeVisible();

  // A nested stalled project shows with its ancestor path (a link to the parent) (#909).
  const tilingRow = page.getByRole('listitem').filter({ hasText: 'Tiling' });
  await expect(tilingRow.getByRole('button', { name: 'Open Tiling' })).toBeVisible();
  await expect(tilingRow.getByRole('link', { name: 'Kitchen reno' })).toBeVisible();

  // Reference counts link to their own homes; the blocked action with two prerequisites counts once.
  await expect(page.getByRole('link', { name: 'Inbox 1' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Blocked 1' })).toBeVisible();

  // Reachable from the sidebar, and drilling a stalled project opens its workbench.
  await expect(page.getByRole('link', { name: 'Loose ends' })).toBeVisible();
  await stalled.click();
  await expect(page).toHaveURL(/\/projects\/p$/);
});

test('a stalled project row carries copy + inline rename — fix a typo right there (#911)', async ({ page, doc }) => {
  await page.goto('/loose-ends');
  // Copy the name is available on the row.
  await expect(page.getByRole('button', { name: 'Copy name "Paint the shed"' })).toBeVisible();

  // Rename inline: pencil → edit field → Enter commits, and the doc updates.
  await page.getByRole('button', { name: 'Rename Paint the shed' }).click();
  const input = page.getByRole('textbox', { name: 'Rename Paint the shed' });
  await input.fill('Paint the fence');
  await input.press('Enter');
  await expect(page.getByRole('button', { name: 'Open Paint the fence' })).toBeVisible();
  await expect.poll(() => doc.current().nodes['p'].title).toBe('Paint the fence');
});

test('marking a project #not-stalled drops it off; Show acknowledged brings it back to un-mark (#909)', async ({ page }) => {
  await page.goto('/loose-ends');
  const stalled = page.getByRole('button', { name: 'Open Paint the shed' });
  await expect(stalled).toBeVisible();

  // "Not stalled" tags it and it leaves the default list (respected by default).
  await page.getByRole('button', { name: 'Mark Paint the shed as not stalled' }).click();
  await expect(stalled).toHaveCount(0);

  // The review toggle now appears; turning it on reveals the acknowledged project, badged.
  await page.getByRole('button', { name: 'Show acknowledged' }).click();
  await expect(page).toHaveURL(/acknowledged=1/);
  await expect(page.getByRole('button', { name: 'Open Paint the shed' })).toBeVisible();
  await expect(page.getByText('Acknowledged', { exact: true })).toBeVisible();

  // The same control un-marks it from the review view.
  await page.getByRole('button', { name: 'Undo not stalled for Paint the shed' }).click();
  await expect(page.getByText('Acknowledged', { exact: true })).toHaveCount(0);
});
