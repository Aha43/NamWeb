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

// #622 — no size cap: every item captured this session stays listed; a long streak scrolls in the
// list region only, so the capture field never scrolls away mid-streak.
test('a long capture streak keeps every item, scrolling only the list', async ({ page }) => {
  await page.goto('/inbox');
  await page.getByRole('button', { name: 'Capture', exact: true }).click();

  const dialog = page.getByRole('dialog');
  const field = dialog.getByLabel('Capture to inbox');
  const count = 15;
  for (let i = 1; i <= count; i++) {
    await field.fill(`thought ${i}`);
    await field.press('Enter');
  }

  // Every capture is listed (newest first), none dropped.
  const list = dialog.getByRole('list');
  await expect(list.getByRole('listitem')).toHaveCount(count);
  await expect(list.getByText('thought 15')).toBeVisible();

  // The list itself scrolls; the capture field is still on screen and usable.
  expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await expect(field).toBeInViewport();
  await field.fill('one more');
  await field.press('Enter');
  await expect(list.getByRole('listitem')).toHaveCount(count + 1);

  // The oldest capture is reachable by scrolling within the list.
  await list.getByText('thought 1', { exact: true }).scrollIntoViewIfNeeded();
  await expect(list.getByText('thought 1', { exact: true })).toBeVisible();
  await expect(field).toBeInViewport(); // scrolling the list didn't move the field
});

// #626 — the dialog opens at its default size, but the bottom-right corner handle resizes it
// (width + height), and the size is remembered for the next open.
test('drag the corner handle to resize; the size is remembered', async ({ page }) => {
  await page.goto('/inbox');
  await page.getByRole('button', { name: 'Capture', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Capture' });
  // Let the open (zoom-in) animation settle before measuring.
  const settled = () =>
    dialog.evaluate((el) => el.getAnimations().every((a) => a.playState === 'finished'));
  await expect.poll(settled).toBe(true);
  const before = (await dialog.boundingBox())!;

  // Drag the corner handle outward.
  const handle = dialog.getByRole('separator', { name: 'Resize capture dialog' });
  const grip = (await handle.boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + 120, grip.y + 100, { steps: 5 });
  await page.mouse.up();

  const after = (await dialog.boundingBox())!;
  expect(after.width).toBeGreaterThan(before.width + 50);
  expect(after.height).toBeGreaterThan(before.height + 50);

  // Close and reopen — the dragged size is remembered.
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: 'Capture', exact: true }).click();
  await expect.poll(settled).toBe(true);
  const reopened = (await dialog.boundingBox())!;
  expect(Math.abs(reopened.width - after.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(reopened.height - after.height)).toBeLessThanOrEqual(2);
});

// #568 — a very long name must never push a recent row's buttons out of the dialog; the text
// shrinks/truncates instead, so every control stays reachable. (No Add button to check — #626.)
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

  const editButton = dialog.getByRole('button', { name: `Edit ${longTitle}` });
  const editBox = (await editButton.boundingBox())!;
  expect(editBox.x + editBox.width).toBeLessThanOrEqual(dialogRight);

  // And it is actually clickable — the inline rename opens.
  await editButton.click();
  await expect(dialog.getByRole('textbox', { name: `Rename ${longTitle}` })).toBeVisible();
});
