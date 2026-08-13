import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #588 — project bookmarks live in the sidebar as a split-button: behind a chevron on the Projects
// entry. Context (tag-filter) bookmarking was removed (#1107); saved views are the tag-view feature.
// The toolbar strip is gone. Network-mocked.

test.describe('with bookmarks', () => {
  const seed = new DocBuilder().project('vac', 'Vacation').action('a1', 'Water plants', { tags: ['home'] }).build();
  seed.bookmarks = [
    { id: 'bm1', label: 'Vacation', kind: 'project' as const, projectId: 'vac', color: '#3b82f6' },
    { id: 'bm2', label: 'Old plans', kind: 'project' as const, projectId: 'gone', color: '#f59e0b' }, // stale
  ];
  test.use({ seedDoc: seed });

  test('the Projects chevron lists live project bookmarks and jumps to the project', async ({ page }) => {
    await page.goto('/inbox');

    // The toolbar strip is gone.
    await expect(page.getByRole('button', { name: /Go to bookmark:/ })).toHaveCount(0);

    // The ▾ trigger hints on hover (#679) and still opens the menu (the Tooltip wraps the
    // DropdownMenuTrigger — both clone onto one button; wrong nesting kills the menu).
    await page.getByRole('button', { name: 'Project bookmarks' }).hover();
    await expect(page.getByRole('tooltip')).toHaveText('Project bookmarks');
    await page.getByRole('button', { name: 'Project bookmarks' }).click();
    const menu = page.getByRole('menu');
    await expect(menu.getByText('Vacation')).toBeVisible();
    // Stale: shown greyed with the suffix, not navigable, but removable (#594).
    const staleRow = menu.getByRole('menuitem', { name: /Old plans/ });
    await expect(staleRow).toBeVisible();
    await expect(staleRow).toHaveAttribute('data-disabled', '');

    await menu.getByText('Vacation').click();
    await expect(page).toHaveURL(/\/projects\/vac$/);
  });

  test('remove a stale (and a live) bookmark right from the menu (#594)', async ({ page, doc }) => {
    await page.goto('/inbox');
    await page.getByRole('button', { name: 'Project bookmarks' }).click();
    const menu = page.getByRole('menu');

    // Removing keeps the menu open — clear the dead one, then a live one.
    await menu.getByRole('button', { name: 'Remove bookmark: Old plans' }).click();
    await expect(menu).toBeVisible();
    await expect(menu.getByText('Old plans')).toHaveCount(0);
    await expect.poll(() => doc.current().bookmarks?.map((b) => b.id)).toEqual(['bm1']);

    await menu.getByRole('button', { name: 'Remove bookmark: Vacation' }).click();
    await expect.poll(() => doc.current().bookmarks?.map((b) => b.id)).toEqual([]);
    // No project bookmarks left → the chevron disappears.
    await expect(page.getByRole('button', { name: 'Project bookmarks' })).toHaveCount(0);
  });

  test('the plain Tags view keeps its full workshop (#745)', async ({ page }) => {
    await page.goto('/tags');
    await expect(page.getByRole('button', { name: 'Manage tags' })).toBeVisible();
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

test.describe('bookmark labels grow up (#732)', () => {
  // The dogfooding case: every dev project has a "Next sprint" — the bookmark needs its own name.
  const seed = new DocBuilder()
    .project('dev', 'NAM dev')
    .project('web', 'Web', { under: 'dev' })
    .project('sprint', 'Next sprint', { under: 'web' })
    .build();
  seed.bookmarks = [
    { id: 'bm1', label: 'Next sprint', kind: 'project' as const, projectId: 'sprint', color: '#3b82f6' },
  ];
  test.use({ seedDoc: seed });

  test('a project bookmark tells its full path on hover and takes a custom name', async ({ page, doc }) => {
    await page.goto('/inbox');
    await page.getByRole('button', { name: 'Project bookmarks' }).click();
    const menu = page.getByRole('menu');

    // The row's tooltip is the technical truth: the full project path.
    await menu.getByRole('menuitem', { name: 'Next sprint', exact: true }).hover();
    await expect(page.getByRole('tooltip')).toHaveText('NAM dev › Web › Next sprint');

    // Rename via the pencil — the label is the bookmark's own, the project is untouched.
    await menu.getByRole('menuitem', { name: 'Rename bookmark: Next sprint' }).click();
    const dialog = page.getByRole('dialog', { name: 'Rename bookmark' });
    await dialog.getByLabel('Name').fill('Next sprint (NamWeb)');
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect.poll(() => doc.current().bookmarks?.[0].label).toBe('Next sprint (NamWeb)');
    expect(doc.current().nodes['sprint'].title).toBe('Next sprint');

    await page.getByRole('button', { name: 'Project bookmarks' }).click();
    await expect(page.getByRole('menu').getByText('Next sprint (NamWeb)')).toBeVisible();
  });
});

test.describe('without bookmarks', () => {
  test.use({ seedDoc: new DocBuilder().project('vac', 'Vacation').build() });

  test('no chevron appears beside Projects', async ({ page }) => {
    await page.goto('/inbox');
    await expect(page.getByRole('link', { name: 'Projects' })).toBeVisible(); // command bar rendered
    await expect(page.getByRole('button', { name: 'Project bookmarks' })).toHaveCount(0);
  });

  test('the project explorer works without any bookmarks (#595)', async ({ page }) => {
    await page.goto('/inbox');
    await page.getByRole('button', { name: 'Project explorer' }).click();
    const dialog = page.getByRole('dialog', { name: 'Open project or action' });
    await dialog.getByRole('button', { name: 'Vacation' }).click();
    await dialog.getByRole('button', { name: 'Open', exact: true }).click();
    await expect(page).toHaveURL(/\/projects\/vac$/);
  });
});

test.describe('reorder bookmarks (#636)', () => {
  const seed = new DocBuilder().project('vac', 'Vacation').project('cab', 'Cabin').build();
  seed.bookmarks = [
    { id: 'bm1', label: 'Vacation', kind: 'project' as const, projectId: 'vac', color: '#3b82f6' },
    { id: 'bm2', label: 'Cabin', kind: 'project' as const, projectId: 'cab', color: '#ef4444' },
  ];
  test.use({ seedDoc: seed });

  test('move up swaps the two bookmarks and persists', async ({ page, doc }) => {
    await page.goto('/inbox');
    await page.getByRole('button', { name: 'Project bookmarks' }).click();
    const menu = page.getByRole('menu');

    // Ends disabled; the menu stays open while fiddling.
    await expect(menu.getByRole('button', { name: 'Move Vacation up' })).toBeDisabled();
    await expect(menu.getByRole('button', { name: 'Move Cabin down' })).toBeDisabled();
    await menu.getByRole('button', { name: 'Move Cabin up' }).click();
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Move Cabin up' })).toBeDisabled(); // now first

    await expect.poll(() => doc.current().bookmarks?.map((b) => b.id)).toEqual(['bm2', 'bm1']);

    // The new order survives closing and reopening the menu.
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Project bookmarks' }).click();
    const rows = page.getByRole('menu').getByRole('menuitem');
    await expect(rows.first()).toHaveText(/Cabin/);
  });
});
