import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #921 part 2 — the shared multi-select mechanism reaches the odder shapes: Blocked (grouped under a
// prerequisite) and Search (mixed actions/projects, custom rows).
test.use({
  seedDoc: new DocBuilder()
    .action('a', 'Wash the car', { status: 'NEXT', blockedBy: ['b'] }) // blocked by an unfinished prereq
    .action('b', 'Buy soap', { status: 'BACKLOG' }) // the blocker
    .project('p', 'Soap logistics') // a project that also matches a "soap" search (mixed results)
    .build(),
});

test('Blocked view: select a blocked action and bulk-tag it', async ({ page, doc }) => {
  await page.goto('/blocked');
  await expect(page.getByText('Wash the car')).toBeVisible();

  await page.getByRole('button', { name: 'Select' }).click();
  await page.getByRole('checkbox', { name: 'Select Wash the car' }).check();
  await expect(page.getByText('1 selected')).toBeVisible();

  await page.getByRole('button', { name: 'Add a tag to the selected items' }).click();
  const tagInput = page.getByPlaceholder('Add a tag…');
  await tagInput.fill('errand');
  await tagInput.press('Enter');
  await expect.poll(() => doc.current().nodes['a'].tags).toContain('errand');
});

test('Search view: select a result and bulk-tag it', async ({ page, doc }) => {
  await page.goto('/search');
  await page.getByPlaceholder('Search titles & tags…').fill('soap');
  await expect(page.getByText('Buy soap')).toBeVisible();

  await page.getByRole('button', { name: 'Select' }).click();
  await page.getByRole('checkbox', { name: 'Select Buy soap' }).check();
  await expect(page.getByText('1 selected')).toBeVisible();

  await page.getByRole('button', { name: 'Add a tag to the selected items' }).click();
  const tagInput = page.getByPlaceholder('Add a tag…');
  await tagInput.fill('supplies');
  await tagInput.press('Enter');
  await expect.poll(() => doc.current().nodes['b'].tags).toContain('supplies');
});

// #921 review (P1): Search mixes actions and projects, but the shared bulk bar's move targets are
// action destinations — moveNode would happily reparent a project under one. So a project result must
// not be bulk-selectable; only actions get a checkbox.
test('Search view: a project result is not bulk-selectable (actions only)', async ({ page }) => {
  await page.goto('/search');
  await page.getByPlaceholder('Search titles & tags…').fill('soap');
  await expect(page.getByText('Buy soap')).toBeVisible();
  await expect(page.getByText('Soap logistics')).toBeVisible();

  await page.getByRole('button', { name: 'Select' }).click();
  await expect(page.getByRole('checkbox', { name: 'Select Buy soap' })).toBeVisible(); // the action
  await expect(page.getByRole('checkbox', { name: 'Select Soap logistics' })).toHaveCount(0); // the project
});

// #921 review (P1): a selection made under one query must not survive a query change and act on a
// now-hidden node. The bar intersects the pick with the visible rows, so the hidden pick drops to 0.
test('Search view: changing the query drops a now-hidden pick (no off-screen mutation)', async ({ page }) => {
  await page.goto('/search');
  await page.getByPlaceholder('Search titles & tags…').fill('soap');
  await page.getByRole('button', { name: 'Select' }).click();
  await page.getByRole('checkbox', { name: 'Select Buy soap' }).check();
  await expect(page.getByText('1 selected')).toBeVisible();

  // Change the query so 'Buy soap' is no longer shown; the pick is now off-screen.
  await page.getByPlaceholder('Search titles & tags…').fill('car');
  await expect(page.getByText('Wash the car')).toBeVisible();
  // The hidden pick is intersected away: 0 selected, and every bulk op (delete included) is disabled.
  await expect(page.getByText('0 selected')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete selected items' })).toBeDisabled();
});
