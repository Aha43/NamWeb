import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #438 — an action can carry a date range (start + optional end); the row shows it and the end is
// stored in dueEndAt. Sort/grouping stay keyed on the start. Network-mocked.
test.use({
  seedDoc: new DocBuilder().action('trip', 'Trip').build(),
});

test('set a due-date range in the editor; it saves and shows on the row', async ({ page, doc }) => {
  await page.goto('/next');

  await page.getByRole('button', { name: 'Edit Trip' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Due', { exact: true }).fill('2026-08-12');
  await dialog.getByLabel('Due end (optional)').fill('2026-08-16');
  await dialog.getByRole('button', { name: 'Save' }).click();

  // Persisted as a range (start in dueAt, end in dueEndAt).
  await expect.poll(() => doc.current().nodes['trip'].dueAt).toBe('2026-08-12');
  await expect.poll(() => doc.current().nodes['trip'].dueEndAt).toBe('2026-08-16');

  // The row renders it as a range ("Due <start> – <end>").
  await expect(page.getByText(/Due .+ – /)).toBeVisible();
});

test('rejects an end before the start (no save)', async ({ page, doc }) => {
  await page.goto('/next');

  await page.getByRole('button', { name: 'Edit Trip' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Due', { exact: true }).fill('2026-08-16');
  await dialog.getByLabel('Due end (optional)').fill('2026-08-12');
  await dialog.getByRole('button', { name: 'Save' }).click();

  // Still open, with an error; nothing persisted.
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expect.poll(() => doc.current().nodes['trip'].dueEndAt ?? null).toBeNull();
});
