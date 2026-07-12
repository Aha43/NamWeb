import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #471 — deleting an inbox item is instant (no confirm) but recoverable via the short-lived Undo
// toast, like delete elsewhere in the app.
test.use({
  seedDoc: new DocBuilder().inbox('i1', 'Buy tiles').inbox('i2', 'Email Sam').build(),
});

test('deleting an inbox item shows Undo, and Undo restores it', async ({ page, doc }) => {
  await page.goto('/inbox');

  await page.getByRole('button', { name: 'Delete Buy tiles' }).click();
  // Row gone, but a "Deleted …" Undo toast appears (no confirm dialog).
  await expect(page.getByRole('button', { name: 'Delete Buy tiles' })).toHaveCount(0);
  await expect(page.getByText(/Deleted "Buy tiles"/)).toBeVisible();
  await expect.poll(() => doc.current().nodes['i1']).toBeFalsy();

  await page.getByRole('button', { name: 'Undo' }).click();
  // Restored to its place in the inbox.
  await expect(page.getByRole('button', { name: 'Delete Buy tiles' })).toBeVisible();
  await expect.poll(() => doc.current().nodes[doc.current().inboxNodeId].childIds).toContain('i1');
});

// #744 — the same Undo without the mouse travel: ⌘/Ctrl+Z fires the toast's action.
test('Ctrl+Z undoes straight from the keyboard while the toast is up', async ({ page, doc }) => {
  await page.goto('/inbox');

  await page.getByRole('button', { name: 'Delete Email Sam' }).click();
  await expect(page.getByText(/Deleted "Email Sam"/)).toBeVisible();
  await expect.poll(() => doc.current().nodes['i2']).toBeFalsy();

  await page.keyboard.press('Control+z');
  await expect(page.getByRole('button', { name: 'Delete Email Sam' })).toBeVisible();
  await expect(page.getByText(/Deleted "Email Sam"/)).toHaveCount(0); // toast dismissed, like a click
});
