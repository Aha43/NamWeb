import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #921 part 2 — the shared multi-select mechanism reaches the odder shapes: Blocked (grouped under a
// prerequisite) and Search (mixed actions/projects, custom rows).
test.use({
  seedDoc: new DocBuilder()
    .action('a', 'Wash the car', { status: 'NEXT', blockedBy: ['b'] }) // blocked by an unfinished prereq
    .action('b', 'Buy soap', { status: 'BACKLOG' }) // the blocker
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
