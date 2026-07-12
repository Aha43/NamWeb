import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #739 — the phone half of the Focus speed dial: the More-sheet bookmark rows carry a target
// glyph beside the label — tap the label to view, tap the target to deal the scoped deck,
// closing the sheet on the way. Network-mocked, iPhone 13 viewport.

const seed = new DocBuilder().action('a1', 'Water plants', { tags: ['daily'], status: 'NEXT' }).build();
seed.bookmarks = [
  { id: 'bm1', label: 'After work', kind: 'tagFilter' as const, tags: ['daily'], nextOnly: true, color: '#10b981' },
];
test.use({ seedDoc: seed });

test('tap a bookmark row\'s target glyph — straight into the scoped deck', async ({ page }) => {
  await page.goto('/inbox');
  await page.getByRole('button', { name: 'More' }).click();

  await page.getByRole('button', { name: 'Focus: After work' }).click();

  // Straight into the deck, sheet closed behind us.
  await expect(page).toHaveURL(/\/focus\?tags=daily&next=1$/);
  await expect(page.getByText('Water plants')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'More' })).toBeHidden();

  // The label tap keeps meaning "view" — the sheet's existing behavior is untouched.
  await page.getByRole('button', { name: 'Exit focus' }).click();
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Go to bookmark: After work' }).click();
  await expect(page).toHaveURL(/\/tags\?tags=daily&next=1&bm=bm1$/); // lands on the bookmark view (#745)
});
