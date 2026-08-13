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

// #968 review (P1-a): the in-progress filter must travel into the Focus deck — otherwise clicking
// Focus while filtered rebuilds the FULL queue.
test('Next view: Focus while in-progress-filtered scopes the deck to in-progress', async ({ page }) => {
  await page.goto('/next');
  await page.getByRole('button', { name: 'Show in-progress only' }).click();

  await page.getByRole('button', { name: 'Focus your Next actions' }).click();

  await expect(page).toHaveURL(/\/focus\?inProgress=1/);
  await expect(page.getByLabel('Progress')).toHaveText('1 / 1'); // only the in-progress card
  await expect(page.getByRole('heading', { name: 'Wash the car' })).toBeVisible();
  await expect(page.getByText('Buy soap')).toHaveCount(0);
});

// #968 review (P1-b): a manual reorder while filtered must merge back into the FULL saved order,
// leaving the hidden (non-in-progress) rows in their original slots.
test.describe('filtered reorder preserves hidden rows', () => {
  test.use({
    seedDoc: new DocBuilder()
      .action('h1', 'Mow lawn', { status: 'NEXT' })
      .action('p1', 'Call bank', { status: 'NEXT', tags: ['#in-progress'] })
      .action('h2', 'Buy soap', { status: 'NEXT' })
      .action('p2', 'Email Sam', { status: 'NEXT', tags: ['#in-progress'] })
      .action('h3', 'Water plants', { status: 'NEXT' })
      .build(),
  });

  test('moving a visible row does not strand the hidden rows on filter-clear', async ({ page, doc }) => {
    await page.goto('/next');
    await page.getByRole('button', { name: 'Show in-progress only' }).click();

    // Visible = [Call bank, Email Sam]. Move the second one up.
    await page.getByRole('button', { name: 'Move Email Sam up' }).click();

    // The full saved order keeps the hidden rows in place (h1 first, h2 middle, h3 last) while the
    // two in-progress rows swap. The buggy path would drop h1/h2/h3 to the bottom.
    await expect
      .poll(() => doc.current().viewOrders.next ?? [])
      .toEqual(['h1', 'p2', 'h2', 'p1', 'h3']);
  });
});

// #968 review (P2): the Tags in-progress filter is session state — a fresh landing (a different
// saved view) must not inherit it, or the second context shows an empty/partial list.
test.describe('Tags in-progress filter does not leak across context visits', () => {
  const seed = new DocBuilder()
    .action('h1', 'Mow lawn', { status: 'NEXT', tags: ['home'] })
    .action('h2', 'Trim hedge', { status: 'NEXT', tags: ['home', '#in-progress'] })
    .action('w1', 'Email client', { status: 'NEXT', tags: ['work'] })
    .build();
  seed.savedViews = [
    { name: 'Home', tags: ['home'], nextOnly: false },
    { name: 'Work', tags: ['work'], nextOnly: false },
  ];
  test.use({ seedDoc: seed });

  test('switching to another saved view resets the in-progress filter', async ({ page }) => {
    await page.goto('/tags');

    // Open the Home context via its saved view, then filter to in-progress (hides Mow lawn).
    await page.getByRole('button', { name: 'Open view Home' }).click();
    await expect(page.getByText('Trim hedge')).toBeVisible();
    await page.getByRole('button', { name: 'Show in-progress only' }).click();
    await expect(page.getByText('Mow lawn')).toHaveCount(0);

    // Switch to the Work context — a fresh landing. Work has no in-progress item, so a leaked
    // filter would hide Email client entirely. It must be visible (filter reset).
    await page.getByRole('button', { name: 'Open view Work' }).click();
    await expect(page.getByText('Email client')).toBeVisible();
  });
});
