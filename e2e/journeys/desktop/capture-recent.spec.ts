import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #478 — the capture dialog keeps the last few items captured this session, editable inline, so a
// fast streak doesn't "just disappear" and typos are fixable on the spot.
test.use({ seedDoc: new DocBuilder().build() });

test('recent captures stay listed in the dialog and are editable', async ({ page, doc }) => {
  await page.goto('/inbox');
  await page.getByRole('button', { name: 'Capture', exact: true }).click();

  const dialog = page.getByRole('dialog');
  const field = dialog.getByLabel('Capture to inbox');

  await field.fill('Buy tiles');
  await field.press('Enter');
  await field.fill('Email Sam');
  await field.press('Enter');

  // Both linger under "Just added" (newest first), even though the field cleared.
  const list = dialog.getByRole('list');
  await expect(list.getByText('Buy tiles')).toBeVisible();
  await expect(list.getByText('Email Sam')).toBeVisible();

  // Fix a typo inline → renames the real inbox item.
  await dialog.getByRole('button', { name: 'Edit Buy tiles' }).click();
  const rename = dialog.getByRole('textbox', { name: 'Rename Buy tiles' });
  await rename.fill('Buy floor tiles');
  await rename.press('Enter');
  await expect(list.getByText('Buy floor tiles')).toBeVisible();
  await expect.poll(() =>
    Object.values(doc.current().nodes).some((n) => n.title === 'Buy floor tiles'),
  ).toBe(true);

  // The list is session-only: closing and reopening starts empty.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Capture', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Just added')).toHaveCount(0);
});

// #617 — a mis-capture is deletable right from the list, with the Undo toast as the safety net;
// clicking Undo must not close the capture dialog mid-streak.
test('delete a just-captured item from the list, undo from the toast', async ({ page, doc }) => {
  await page.goto('/inbox');
  await page.getByRole('button', { name: 'Capture', exact: true }).click();

  const dialog = page.getByRole('dialog');
  const field = dialog.getByLabel('Capture to inbox');
  await field.fill('Oops wrong thought');
  await field.press('Enter');
  await field.fill('Keep this one');
  await field.press('Enter');

  const list = dialog.getByRole('list');
  await dialog.getByRole('button', { name: 'Delete Oops wrong thought' }).click();

  // The row is gone from the list and from the workspace; the other capture stays.
  await expect(list.getByText('Oops wrong thought')).toHaveCount(0);
  await expect(list.getByText('Keep this one')).toBeVisible();
  await expect.poll(() =>
    Object.values(doc.current().nodes).some((n) => n.title === 'Oops wrong thought'),
  ).toBe(false);

  // Undo from the toast — the dialog must stay open, and the row comes back.
  // (CSS locator: the modal dialog aria-hides the rest of the page, so role queries
  // can't see the toast — it stays visible and clickable above the overlay regardless.)
  await page.locator('[role="status"] button', { hasText: 'Undo' }).click();
  await expect(dialog).toBeVisible();
  await expect(list.getByText('Oops wrong thought')).toBeVisible();
  await expect.poll(() =>
    Object.values(doc.current().nodes).some((n) => n.title === 'Oops wrong thought'),
  ).toBe(true);
});

// #617 — the number of items that stay listed is a preference (default 4).
test('the capture-list size preference applies', async ({ page }) => {
  await page.goto('/account?tab=preferences');
  await page.getByLabel('Capture list size').fill('2');

  await page.getByRole('button', { name: 'Capture', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const field = dialog.getByLabel('Capture to inbox');
  for (const title of ['one', 'two', 'three']) {
    await field.fill(title);
    await field.press('Enter');
  }

  // Only the newest two linger.
  const list = dialog.getByRole('list');
  await expect(list.getByRole('listitem')).toHaveCount(2);
  await expect(list.getByText('three')).toBeVisible();
  await expect(list.getByText('two')).toBeVisible();
  await expect(list.getByText('one')).toHaveCount(0);
});

// #568 — a very long name must never push the Add button or a recent row's buttons out of the
// dialog; the text shrinks/truncates instead, so every control stays reachable.
test('a long name truncates instead of pushing buttons out of the dialog', async ({ page }) => {
  await page.goto('/inbox');
  await page.getByRole('button', { name: 'Capture', exact: true }).click();

  const dialog = page.getByRole('dialog');
  const field = dialog.getByLabel('Capture to inbox');
  const longTitle =
    'Pick up the extra long fence posts from the hardware store before the weekend rush starts and keep all the receipts';
  await field.fill(longTitle);
  await field.press('Enter');

  const dialogBox = (await dialog.boundingBox())!;
  const dialogRight = dialogBox.x + dialogBox.width;

  const addBox = (await dialog.getByRole('button', { name: 'Add' }).boundingBox())!;
  expect(addBox.x + addBox.width).toBeLessThanOrEqual(dialogRight);

  const editButton = dialog.getByRole('button', { name: `Edit ${longTitle}` });
  const editBox = (await editButton.boundingBox())!;
  expect(editBox.x + editBox.width).toBeLessThanOrEqual(dialogRight);

  // And it is actually clickable — the inline rename opens.
  await editButton.click();
  await expect(dialog.getByRole('textbox', { name: `Rename ${longTitle}` })).toBeVisible();
});
