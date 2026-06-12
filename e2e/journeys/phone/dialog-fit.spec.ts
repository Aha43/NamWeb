import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// Regression for #74: the Action edit dialog must fit within a small screen rather than
// overflowing past the top/bottom edges (which left its footer unreachable). A short viewport
// guarantees the tall editor would overflow without the fix; we assert the dialog's box stays
// inside the viewport (the fix caps its height and makes it scroll internally).
const VIEWPORT = { width: 390, height: 420 };

test.use({
  // Extra actions make the editor tall (blocker-candidate picker + reshape both render).
  seedDoc: new DocBuilder()
    .action('a1', 'Buy concert tickets')
    .action('a2', 'Book the hotel')
    .action('a3', 'Arrange the dog sitter')
    .build(),
  viewport: VIEWPORT,
});

test('the edit dialog fits a small screen', async ({ page }) => {
  await page.goto('/next');
  await page.getByRole('button', { name: 'Edit Buy concert tickets' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Edit action')).toBeVisible();

  // The dialog must sit within the viewport — not clipped above or below it.
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(VIEWPORT.height + 1);
});
