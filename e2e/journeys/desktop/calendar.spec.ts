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
  // On the 1st, yesterday lives in the previous month's grid — navigate there like a user would (#696).
  const yesterdayElsewhere = (await dayCell(localDate(-1)).count()) === 0;
  if (yesterdayElsewhere) await page.getByRole('button', { name: 'Previous month' }).click();
  await expect(dayCell(localDate(-1))).toHaveText(/1/);
  await expect(dayCell(localDate(-1))).toHaveClass(/destructive/);
  // Back to the current month for the checks below (Today is disabled when already there).
  if (yesterdayElsewhere) await page.getByRole('button', { name: 'Today', exact: true }).click();

  // Week gutter (#680): the row for today carries a blue ISO week number with a tooltip.
  const weekCells = page.locator('[aria-label^="Week "]');
  await expect(weekCells.first()).toBeVisible();
  await weekCells.first().hover();
  await expect(page.getByRole('tooltip')).toHaveText(/Week \d+/);

  // Month navigation drives the URL; Today returns.
  await page.getByRole('button', { name: 'Next month' }).click();
  await expect(page).toHaveURL(/calendar\?m=\d{4}-\d{2}/);
  await page.getByRole('button', { name: 'Previous year' }).click();
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page).toHaveURL(/\/calendar$/);
  await expect(dayCell(localDate(0))).toHaveClass(/ring-2/);
});

test('garbage calendar URLs fall back instead of crashing (#696)', async ({ page }) => {
  // ?d= that passes the shape check but is not a real date must not reach the date formatter.
  await page.goto('/calendar?d=2026-99-99');
  await expect(page.getByRole('grid')).toBeVisible();
  // Nonsense month falls back to today's month (today ring present).
  await page.goto('/calendar?m=2026-99');
  await expect(page.locator(`[aria-label^="${localDate(0)}:"]`)).toHaveClass(/ring-2/);
});

test("hovering a day lists that day's action titles (#689)", async ({ page }) => {
  await page.goto('/calendar');
  await expect(page.getByRole('grid')).toBeVisible();
  await page.locator(`[aria-label^="${localDate(0)}:"]`).hover();
  const tip = page.getByRole('tooltip');
  await expect(tip).toContainText('Due today A');
  await expect(tip).toContainText('Due today B');
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

test('day drill-in: click a day, see its actions, edit one, come back (#676)', async ({ page }) => {
  await page.goto('/calendar');
  await expect(page.getByRole('grid')).toBeVisible();
  await page.locator(`[aria-label^="${localDate(0)}:"]`).click();

  // The grid swapped for the day's list; DONE stays invisible.
  await expect(page).toHaveURL(new RegExp(`d=${localDate(0)}`));
  await expect(page.getByText('Due today A')).toBeVisible();
  await expect(page.getByText('Due today B')).toBeVisible();
  await expect(page.getByText('Finished')).toHaveCount(0);

  // Rows carry the standard affordances — editing opens the action editor.
  await page.getByRole('button', { name: 'Edit Due today A' }).click();
  const editor = page.getByRole('dialog', { name: 'Edit action' });
  await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('Due today A');
  await editor.getByRole('button', { name: 'Cancel' }).click();

  // The back affordance returns to the same month's grid.
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  await expect(page.getByRole('grid')).toBeVisible();
  await expect(page.locator(`[aria-label^="${localDate(0)}:"]`)).toHaveClass(/ring-2/);

  // An empty day says so, with the way back intact. Tomorrow is empty (the range starts at +2);
  // near month-end it may live in the next month's grid — navigate there like a user would.
  const emptyDay = localDate(1);
  if ((await page.locator(`[aria-label^="${emptyDay}:"]`).count()) === 0) {
    await page.getByRole('button', { name: 'Next month' }).click();
  }
  await page.locator(`[aria-label^="${emptyDay}:"]`).click();
  await expect(page.getByText('Nothing due this day.')).toBeVisible();
  await page.getByRole('button', { name: 'Calendar', exact: true }).click();
  await expect(page.getByRole('grid')).toBeVisible();
});

test('create an action from a day, due prefilled at noon (#681)', async ({ page, doc }) => {
  await page.goto('/calendar');
  await expect(page.getByRole('grid')).toBeVisible();
  await page.locator(`[aria-label^="${localDate(0)}:"]`).click();

  await page.getByRole('button', { name: 'New action' }).click();
  const editor = page.getByRole('dialog', { name: 'Edit action' });
  await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('New action');
  await editor.getByRole('textbox', { name: 'Title' }).fill('Plan the party');
  await editor.getByRole('button', { name: 'Save' }).click();

  // Born scheduled: the listed day at noon; visible in the day list immediately.
  await expect.poll(() => {
    const n = Object.values(doc.current().nodes).find((x: { title: string }) => x.title === 'Plan the party') as
      | { dueAt: string; dueTime: string }
      | undefined;
    return n && `${n.dueAt} ${n.dueTime}`;
  }).toBe(`${localDate(0)} 12:00`);
  await expect(page.getByText('Plan the party')).toBeVisible();
});
