import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #738 — the Focus speed dial: a chevron beside the command bar's Focus entry lists all
// bookmarks; clicking one deals the deck scoped to it (project → its open direct actions,
// context → the tag filter). The dial is a pure projection of the bookmarks. Network-mocked.

const seed = new DocBuilder()
  .project('vac', 'Vacation')
  .action('a1', 'Book flights', { under: 'vac', status: 'NEXT' })
  .action('a2', 'Water plants', { tags: ['daily'], status: 'NEXT' })
  .build();
seed.bookmarks = [
  { id: 'bm1', label: 'Vacation', kind: 'project' as const, projectId: 'vac', color: '#3b82f6' },
  { id: 'bm2', label: 'After work', kind: 'tagFilter' as const, tags: ['daily'], nextOnly: true, color: '#10b981' },
];
test.use({ seedDoc: seed });

test('speed-dial a context bookmark straight into its deck, exit back to the view', async ({ page }) => {
  await page.goto('/inbox');

  await page.getByRole('button', { name: 'Focus bookmarks' }).click();
  await page.getByRole('menuitem', { name: 'Focus: After work' }).click();

  // Straight into the scoped deck — no stop at the Contexts view.
  await expect(page).toHaveURL(/\/focus\?tags=daily&next=1$/);
  await expect(page.getByText('Focus: daily')).toBeVisible(); // scoped header
  await expect(page.getByText('Water plants')).toBeVisible(); // the card

  // Exit lands on the matching tag-filter view, selection intact.
  await page.getByRole('button', { name: 'Exit focus' }).click();
  await expect(page).toHaveURL(/\/tags\?tags=daily&next=1$/);
});

test('speed-dial a project bookmark — the workbench Focus semantics, one click', async ({ page }) => {
  await page.goto('/inbox');

  await page.getByRole('button', { name: 'Focus bookmarks' }).click();
  await page.getByRole('menuitem', { name: 'Focus: Vacation' }).click();

  await expect(page).toHaveURL(/\/focus\?project=vac$/);
  await expect(page.getByText('Focus: Vacation')).toBeVisible();
  await expect(page.getByText('Book flights')).toBeVisible();
});

test('the plain Focus entry keeps meaning global Next — the chevron is additive', async ({ page }) => {
  await page.goto('/inbox');
  await page.getByRole('link', { name: 'Focus' }).click();
  await expect(page).toHaveURL(/\/focus$/);
});
