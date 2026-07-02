import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #588 — bookmarks live in the sidebar as split-buttons: project bookmarks behind a chevron on the
// Projects entry, context (tag-filter) bookmarks behind one on the Contexts button. The toolbar
// strip is gone. Network-mocked.

test.describe('with bookmarks', () => {
  const seed = new DocBuilder().project('vac', 'Vacation').action('a1', 'Water plants', { tags: ['home'] }).build();
  seed.bookmarks = [
    { id: 'bm1', label: 'Vacation', kind: 'project' as const, projectId: 'vac', color: '#3b82f6' },
    { id: 'bm2', label: 'Old plans', kind: 'project' as const, projectId: 'gone', color: '#f59e0b' }, // stale
    { id: 'bm3', label: '#home', kind: 'tagFilter' as const, tags: ['home'], nextOnly: true, color: '#10b981' },
  ];
  test.use({ seedDoc: seed });

  test('the Projects chevron lists live project bookmarks and jumps to the project', async ({ page }) => {
    await page.goto('/inbox');

    // The toolbar strip is gone.
    await expect(page.getByRole('button', { name: /Go to bookmark:/ })).toHaveCount(0);

    await page.getByRole('button', { name: 'Project bookmarks' }).click();
    const menu = page.getByRole('menu');
    await expect(menu.getByText('Vacation')).toBeVisible();
    await expect(menu.getByText('Old plans')).toHaveCount(0); // stale → filtered out

    await menu.getByText('Vacation').click();
    await expect(page).toHaveURL(/\/projects\/vac$/);
  });

  test('the Contexts chevron jumps to the bookmarked tag filter', async ({ page }) => {
    await page.goto('/inbox');

    await page.getByRole('button', { name: 'Context bookmarks' }).click();
    await page.getByRole('menu').getByText('#home').click();

    await expect(page).toHaveURL(/\/tags\?tags=home&next=1$/);
    // The filter is applied: the tagged action shows in the filtered list.
    await expect(page.getByText('Water plants')).toBeVisible();
  });
});

test.describe('without bookmarks', () => {
  test.use({ seedDoc: new DocBuilder().project('vac', 'Vacation').build() });

  test('no chevrons appear beside Projects or Contexts', async ({ page }) => {
    await page.goto('/inbox');
    await expect(page.getByRole('link', { name: 'Projects' })).toBeVisible(); // sidebar rendered
    await expect(page.getByRole('button', { name: 'Project bookmarks' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Context bookmarks' })).toHaveCount(0);
  });
});
