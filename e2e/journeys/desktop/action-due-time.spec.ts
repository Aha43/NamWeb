import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #493 — an action can carry a time of day on its due date (appointments). Entry is progressive
// (a bare hour works); the row shows the time after the date. Network-mocked.
test.use({
  seedDoc: new DocBuilder().action('appt', 'Doctor').build(),
});

test('set a due time in the editor; it saves and shows on the row', async ({ page, doc }) => {
  await page.goto('/next');

  await page.getByRole('button', { name: 'Edit Doctor' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Due', { exact: true }).fill('2026-08-12');
  await dialog.getByLabel('Due time (optional)').fill('14:30');
  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect.poll(() => doc.current().nodes['appt'].dueAt).toBe('2026-08-12');
  await expect.poll(() => doc.current().nodes['appt'].dueTime).toBe('14:30');
  await expect(page.getByText(/Due .*14:30/)).toBeVisible();
});

test('a bare hour fills minutes (9 → 09:00)', async ({ page, doc }) => {
  await page.goto('/next');

  await page.getByRole('button', { name: 'Edit Doctor' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Due', { exact: true }).fill('2026-08-12');
  await dialog.getByLabel('Due time (optional)').fill('9');
  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect.poll(() => doc.current().nodes['appt'].dueTime).toBe('09:00');
});
