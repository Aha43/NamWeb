import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #499 — an optional calendar popover next to the Due input fills the date; type-in is unchanged.
test.use({
  seedDoc: new DocBuilder().action('a1', 'Book flights').build(),
});

test('pick a due date from the calendar popover', async ({ page, doc }) => {
  await page.goto('/next');
  await page.getByRole('button', { name: 'Edit Book flights' }).click();
  const dialog = page.getByRole('dialog');

  // Open the calendar by the Due input and pick a day.
  await dialog.getByRole('button', { name: 'Pick a due date from a calendar' }).click();
  const calendar = page.getByRole('button', { name: '2026-08-12' });
  // Navigate to August 2026 if needed (the grid opens on today's month).
  for (let i = 0; i < 24 && !(await calendar.isVisible().catch(() => false)); i++) {
    await page.getByRole('button', { name: 'Next month' }).click();
  }
  await calendar.click();

  // The Due input is filled with the ISO date; type-in still works alongside.
  await expect(dialog.getByLabel('Due', { exact: true })).toHaveValue('2026-08-12');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => doc.current().nodes['a1'].dueAt).toBe('2026-08-12');
});
