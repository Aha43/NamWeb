import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #979 — a search result's project path is live (like the paths elsewhere): clicking the last
// component jumps to the project the action lives in, without opening the edit dialog. Network-mocked.
test.use({
  seedDoc: new DocBuilder()
    .project('p', 'Vacation')
    .action('a', 'Book the hotel', { status: 'NEXT', under: 'p' })
    .build(),
});

test('Search: click a result row path to open the project it lives in', async ({ page }) => {
  await page.goto('/search');
  await page.getByPlaceholder('Search titles & tags…').fill('hotel');
  await expect(page.getByText('Book the hotel')).toBeVisible();

  // The path is a real link, not plain text — click it and land in the project (not the editor).
  await page.getByRole('link', { name: 'Vacation' }).click();
  await expect(page).toHaveURL(/\/projects\/p$/);
});
