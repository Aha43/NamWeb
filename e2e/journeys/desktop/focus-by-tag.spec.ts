import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #301 — Focus a single tag: filter on the Tags view, hit Focus, and the deck holds only the
// matching actions. The filtering lives in the Tags view; Focus mode's UI is unchanged. Mocked.
test.use({
  seedDoc: new DocBuilder()
    .action('h1', 'Mow the lawn', { status: 'NEXT', tags: ['home'] })
    .action('w1', 'Email the client', { status: 'NEXT', tags: ['work'] })
    .build(),
});

test('focus a single tag from the Tags view', async ({ page }) => {
  await page.goto('/tags');
  await page.getByRole('button', { name: 'home' }).click(); // select the tag

  await page.getByRole('button', { name: 'Focus' }).click();

  // Lands in Focus, scoped to the tag, with only the home action.
  await expect(page).toHaveURL(/\/focus\?tags=home/);
  await expect(page.getByText('Focus: home')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mow the lawn' })).toBeVisible();
  await expect(page.getByLabel('Progress')).toHaveText('1 / 1'); // not the work action
});
