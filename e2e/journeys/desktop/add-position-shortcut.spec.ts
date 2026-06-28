import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #450 — Shift+Enter in an add box flips the add-to-top/bottom default AND drops the item you just
// typed at the flipped end too. Inbox defaults to add-at-top, so a flipped add lands below the
// existing item. Network-mocked.
test.use({
  seedDoc: new DocBuilder().inbox('first', 'First item').build(),
});

test('Shift+Enter adds the new inbox item at the flipped (bottom) end', async ({ page }) => {
  await page.goto('/inbox');
  const input = page.getByLabel('Quick add');
  await input.fill('Second item');
  await input.press('Shift+Enter');

  // Both present, and the flipped add put "Second item" below "First item" (default is top).
  const first = await page.getByText('First item').boundingBox();
  const second = await page.getByText('Second item').boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  expect(second!.y).toBeGreaterThan(first!.y);
});
