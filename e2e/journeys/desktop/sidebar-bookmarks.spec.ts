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

test.describe('bookmark as starting point (#595)', () => {
  // A hub bookmark: "NAM dev" › "Web" › "Next sprint" — the destinations are descendants of the
  // bookmark, so you browse from it instead of bookmarking every endpoint.
  const seed = new DocBuilder()
    .project('dev', 'NAM dev')
    .project('web', 'Web', { under: 'dev' })
    .project('sprint', 'Next sprint', { under: 'web' })
    .build();
  seed.bookmarks = [{ id: 'bm1', label: 'NAM dev', kind: 'project' as const, projectId: 'dev', color: '#3b82f6' }];
  test.use({ seedDoc: seed });

  test('browse from a bookmarked hub and open a descendant', async ({ page }) => {
    await page.goto('/inbox');

    // Each bookmark row is split: the label opens the project; "…" browses from it.
    await page.getByRole('button', { name: 'Project bookmarks' }).click();
    await page.getByRole('menuitem', { name: 'Browse from NAM dev' }).click();

    // The picker opens in open mode, already navigated to the hub — its children are one click away.
    const dialog = page.getByRole('dialog', { name: 'Open project' });
    await dialog.getByRole('button', { name: 'Web' }).click();
    await dialog.getByRole('button', { name: 'Next sprint' }).click();
    await dialog.getByRole('button', { name: 'Open', exact: true }).click();

    await expect(page).toHaveURL(/\/projects\/sprint$/);
    // Once the picker has fully closed, the only "Next sprint" left is the workbench title.
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText('Next sprint')).toBeVisible();

  });
});

test.describe('without bookmarks', () => {
  test.use({ seedDoc: new DocBuilder().project('vac', 'Vacation').build() });

  test('no chevrons appear beside Projects or Contexts', async ({ page }) => {
    await page.goto('/inbox');
    await expect(page.getByRole('link', { name: 'Projects' })).toBeVisible(); // command bar rendered
    await expect(page.getByRole('button', { name: 'Project bookmarks' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Context bookmarks' })).toHaveCount(0);
  });

  test('the project explorer works without any bookmarks (#595)', async ({ page }) => {
    await page.goto('/inbox');
    await page.getByRole('button', { name: 'Project explorer' }).click();
    const dialog = page.getByRole('dialog', { name: 'Open project' });
    await dialog.getByRole('button', { name: 'Vacation' }).click();
    await dialog.getByRole('button', { name: 'Open', exact: true }).click();
    await expect(page).toHaveURL(/\/projects\/vac$/);
  });
});
