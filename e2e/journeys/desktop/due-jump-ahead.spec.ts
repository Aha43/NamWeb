import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #986 — quick "jump ahead" presets shift a due date into the future (and move the end date too,
// preserving the span). Land where the math puts it; tweak after. Network-mocked.
test.use({
  seedDoc: new DocBuilder().action('a', 'Renew passport', { dueAt: '2026-07-15' }).build(),
});

test('jump a due date +1 month from the editor', async ({ page, doc }) => {
  await page.goto('/next');

  await page.getByRole('button', { name: 'Edit Renew passport' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /Add due date|Edit due date/i }).click(); // expand the dense due control (#721)

  await dialog.getByRole('button', { name: '+1 month' }).click();
  await expect(dialog.getByLabel('Due', { exact: true })).toHaveValue('2026-08-15');

  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => doc.current().nodes['a'].dueAt).toBe('2026-08-15');
});
