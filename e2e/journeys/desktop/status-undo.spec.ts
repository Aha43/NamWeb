import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #567 — changing an action's status makes it vanish from the current view (Done from Next,
// restore from Done, …), exactly like a delete — so it gets the same short-lived Undo toast.
test.use({
  seedDoc: new DocBuilder()
    .action('a1', 'Get quotes')
    .action('a2', 'Email Sam')
    .build(),
});

test('marking an action Done shows Undo, and Undo brings it back', async ({ page, doc }) => {
  await page.goto('/next');

  // Change status via the row's status badge menu.
  await page.getByRole('button', { name: 'Status of Get quotes: Next' }).click();
  await page.getByRole('menuitem', { name: 'Done' }).click();

  // The row leaves the Next view; the Undo toast appears. (Assert via the row's Edit button —
  // the toast text itself contains the title, so a bare getByText would match it.)
  await expect(page.getByRole('button', { name: 'Edit Get quotes' })).toHaveCount(0);
  await expect(page.getByText('Marked "Get quotes" as Done')).toBeVisible();
  await expect.poll(() => doc.current().nodes['a1'].status).toBe('DONE');

  await page.getByRole('button', { name: 'Undo' }).click();
  // Back in Next, with the original (null) statusChangedAt restored — not the undo's timestamp.
  await expect(page.getByRole('button', { name: 'Edit Get quotes' })).toBeVisible();
  await expect.poll(() => doc.current().nodes['a1'].status).toBe('NEXT');
  await expect.poll(() => doc.current().nodes['a1'].statusChangedAt).toBeNull();
});

test('bulk restore from Done shows one grouped Undo toast', async ({ page, doc }) => {
  // Mark both done first, straight in the document via the two status menus.
  await page.goto('/next');
  for (const title of ['Get quotes', 'Email Sam']) {
    await page.getByRole('button', { name: `Status of ${title}: Next` }).click();
    await page.getByRole('menuitem', { name: 'Done' }).click();
  }
  await expect.poll(() => doc.current().nodes['a2'].status).toBe('DONE');

  await page.goto('/done');
  await page.getByRole('button', { name: 'Select actions' }).click();
  await page.getByLabel('Select Get quotes').check();
  await page.getByLabel('Select Email Sam').check();
  await page.getByRole('button', { name: 'Restore to Next' }).click();

  // One grouped toast; both actions are NEXT again. Undo returns them to Done.
  await expect(page.getByText('Marked 2 actions as Next')).toBeVisible();
  await expect.poll(() => doc.current().nodes['a1'].status).toBe('NEXT');
  await expect.poll(() => doc.current().nodes['a2'].status).toBe('NEXT');

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => doc.current().nodes['a1'].status).toBe('DONE');
  await expect.poll(() => doc.current().nodes['a2'].status).toBe('DONE');
});
