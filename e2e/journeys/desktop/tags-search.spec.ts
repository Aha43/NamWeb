import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// J3 — the sprint-5 cluster: filter active actions by tag (AND), persist the selection as a
// saved view, and find work through the search surface. Network-mocked.
test.use({
  seedDoc: new DocBuilder()
    .action('a1', 'Email Bob', { tags: ['work'] })
    .action('a2', 'Buy soil', { tags: ['home'] })
    .tags('work', 'home')
    .build(),
});

test.describe('tags + search', () => {
  test('filter by a tag and save the selection as a view', async ({ page }) => {
    await page.goto('/tags');

    // Toggle the `work` chip → only the work-tagged action matches.
    await page.getByRole('button', { name: 'work' }).click();
    await expect(page.getByText('Email Bob')).toBeVisible();
    await expect(page.getByText('Buy soil')).toHaveCount(0);
    await expect(page.getByText('1 match', { exact: true })).toBeVisible();

    // Save the current selection as a named view (the panel uses window.prompt).
    page.once('dialog', (dialog) => dialog.accept('Work stuff'));
    await page.getByRole('button', { name: 'Save as view…' }).click();
    await expect(page.getByRole('button', { name: 'Open view Work stuff' })).toBeVisible();
  });

  test('search from the toolbar finds an action by title', async ({ page }) => {
    // Start anywhere; typing in the toolbar search box drives the Search surface via ?q=.
    await page.goto('/inbox');

    await page.getByRole('searchbox', { name: 'Search workspace' }).fill('soil');
    await expect(page).toHaveURL(/\/search\?q=soil/);
    await expect(page.getByRole('button', { name: 'Open Buy soil' })).toBeVisible();
    await expect(page.getByText('Email Bob')).toHaveCount(0);
  });
});
