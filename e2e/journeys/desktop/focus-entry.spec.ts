import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #950 — the focus-bookmark ▾ speed dial was removed from the toolbar (it let you jump into a scoped
// deck without first seeing what you're focusing on). The plain Focus button stays and means global
// Next. (Focus scoped to a bookmark is still reachable by entering Focus from the filtered list.)

const seed = new DocBuilder()
  .action('a1', 'Book flights', { status: 'NEXT' })
  .build();
test.use({ seedDoc: seed });

test('the toolbar Focus button goes to global Next focus, and no bookmark dial sits beside it', async ({ page }) => {
  await page.goto('/inbox');
  await expect(page.getByRole('button', { name: 'Focus bookmarks' })).toHaveCount(0); // the dial is gone
  await page.getByRole('link', { name: 'Focus' }).click();
  await expect(page).toHaveURL(/\/focus$/);
});
