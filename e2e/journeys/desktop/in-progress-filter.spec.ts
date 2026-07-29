import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #968 — the list views can filter to in-progress only (the #in-progress counterpart to the status
// boxes). Here: Next filtered to just the in-progress action.
test.use({
  seedDoc: new DocBuilder()
    .action('a2', 'Buy soap', { status: 'NEXT' })
    .action('a1', 'Wash the car', { status: 'NEXT', tags: ['#in-progress'] })
    .action('a3', 'Water plants', { status: 'NEXT' })
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

// #968 review (F1): adding an action while the in-progress filter is on must write the FULL view
// order, not the filtered subset — otherwise the hidden items get dropped from the saved order.
test('Next view: adding while in-progress-filtered preserves the full saved order', async ({ page, doc }) => {
  // Seed with the in-progress item in the MIDDLE so a drop-to-bottom would be visible.
  // (Uses the file's seed below via a fresh doc.)
  await page.goto('/next');
  await page.getByRole('button', { name: 'Show in-progress only' }).click();

  // Add an action while filtered (it isn't in-progress, so it stays hidden here).
  await page.getByRole('textbox', { name: 'Add a next action' }).fill('Fresh task');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  await page.getByRole('button', { name: 'Show all' }).click();

  // The saved order still holds the non-in-progress items, in their original relative order.
  await expect
    .poll(() => {
      const order = doc.current().viewOrders.next ?? [];
      return order.includes('a2') && order.includes('a3') && order.indexOf('a2') < order.indexOf('a1');
    })
    .toBe(true);
});
