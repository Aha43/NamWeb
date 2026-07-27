import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #968 — the list views can filter to in-progress only (the #in-progress counterpart to the status
// boxes). Here: Next filtered to just the in-progress action.
test.use({
  seedDoc: new DocBuilder()
    .action('a1', 'Wash the car', { status: 'NEXT', tags: ['#in-progress'] })
    .action('a2', 'Buy soap', { status: 'NEXT' })
    .build(),
});

test('Next view: filter to in-progress only', async ({ page }) => {
  await page.goto('/next');
  await expect(page.getByText('Wash the car')).toBeVisible();
  await expect(page.getByText('Buy soap')).toBeVisible();

  // The filter chip shows because there's an in-progress item; toggling it hides the rest.
  await page.getByRole('button', { name: 'Show in-progress only' }).click();
  await expect(page.getByText('Wash the car')).toBeVisible();
  await expect(page.getByText('Buy soap')).toHaveCount(0);

  // Toggle back → both return.
  await page.getByRole('button', { name: 'Show all' }).click();
  await expect(page.getByText('Buy soap')).toBeVisible();
});
