import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

/** Local YYYY-MM-DD, offset days from today (matches the app's local-date semantics). */
function localDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// #675 — the global calendar: toolbar entry, classic month grid with counts + overdue warning +
// today highlight, «‹›» navigation with the month in the URL. Seeds pin dates relative to today.
// NB: offsets stay small so all three dates land in the current month view most days; the specs
// only assert per-date cells, which are found by aria-label regardless of month shown.
test.use({
  seedDoc: new DocBuilder()
    .action('t1', 'Due today A', { dueAt: localDate(0) })
    .action('t2', 'Due today B', { dueAt: localDate(0) })
    .action('past', 'Slipped', { dueAt: localDate(-1) })
    .action('range', 'Offsite', { dueAt: localDate(2), dueEndAt: localDate(4) })
    .action('doneOld', 'Finished', { dueAt: localDate(0), status: 'DONE' })
    .build(),
});

test('toolbar opens the month grid: counts, overdue tint, today ring, month nav', async ({ page }) => {
  await page.goto('/inbox');
  await page.getByRole('link', { name: 'Calendar' }).first().click();
  await expect(page).toHaveURL(/\/calendar$/);

  const dayCell = (date: string) => page.locator(`[aria-label^="${date}:"]`);
  // Today: 2 open (DONE invisible) and ringed; yesterday: 1 with the warning tint.
  await expect(dayCell(localDate(0))).toHaveText(/2/);
  await expect(dayCell(localDate(0))).toHaveClass(/ring-2/);
  await expect(dayCell(localDate(-1))).toHaveText(/1/);
  await expect(dayCell(localDate(-1))).toHaveClass(/destructive/);

  // Month navigation drives the URL; Today returns.
  await page.getByRole('button', { name: 'Next month' }).click();
  await expect(page).toHaveURL(/calendar\?m=\d{4}-\d{2}/);
  await page.getByRole('button', { name: 'Previous year' }).click();
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page).toHaveURL(/\/calendar$/);
  await expect(dayCell(localDate(0))).toHaveClass(/ring-2/);
});

test('a date range lights every day it spans', async ({ page }) => {
  await page.goto('/calendar');
  const dayCell = (date: string) => page.locator(`[aria-label^="${date}:"]`);
  await expect(page.getByRole('grid')).toBeVisible(); // grid rendered before any count() probes
  for (const offset of [2, 3, 4]) {
    // The range days may fall in next month near month-end — navigate there if needed.
    if ((await dayCell(localDate(offset)).count()) === 0) {
      await page.getByRole('button', { name: 'Next month' }).click();
    }
    await expect(dayCell(localDate(offset))).toHaveText(/1/);
  }
});
