import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// A date comfortably in the FUTURE relative to real today, computed at run time (the calendar's
// forward-only "Next month" loop below can only reach future months). A hardcoded date silently broke
// the nightly once real time moved past it — this mirrors the localDate() pattern the calendar specs use.
function localDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const TARGET = localDate(70); // ~2+ months out → always a future month, so ≥1 "Next month" click runs

// #499 — an optional calendar popover next to the Due input fills the date; type-in is unchanged.
test.use({
  seedDoc: new DocBuilder().action('a1', 'Book flights').build(),
});

test('pick a due date from the calendar popover', async ({ page, doc }) => {
  await page.goto('/next');
  await page.getByRole('button', { name: 'Edit Book flights' }).click();
  const dialog = page.getByRole('dialog');

  // The due controls are dense until expanded (#721).
  await dialog.getByRole('button', { name: /Add due date|Edit due date/i }).click();
  // Open the calendar by the Due input and pick a day.
  await dialog.getByRole('button', { name: 'Pick a due date from a calendar' }).click();
  const calendar = page.getByRole('button', { name: TARGET });
  // Navigate forward to the target month (the grid opens on today's month; TARGET is months ahead).
  for (let i = 0; i < 24 && !(await calendar.isVisible().catch(() => false)); i++) {
    await page.getByRole('button', { name: 'Next month' }).click();
  }
  await calendar.click();

  // The Due input is filled with the ISO date; type-in still works alongside.
  await expect(dialog.getByLabel('Due', { exact: true })).toHaveValue(TARGET);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => doc.current().nodes['a1'].dueAt).toBe(TARGET);
});
