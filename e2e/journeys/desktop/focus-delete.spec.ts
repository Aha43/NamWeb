import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #978 — Delete is promoted to a primary action beside Done on the execution decks (most everyday
// cards get deleted on completion, not archived). It still confirms before removing. Network-mocked.
test.use({
  seedDoc: new DocBuilder()
    .action('n1', 'Remember the milk', { status: 'NEXT' })
    .action('n2', 'Second next', { status: 'NEXT' })
    .build(),
});

test('delete the current card from the Next focus deck via the primary Delete', async ({ page, doc }) => {
  await page.goto('/focus'); // the Next execution queue

  await expect(page.getByRole('heading', { name: 'Remember the milk' })).toBeVisible();
  await expect(page.getByLabel('Progress')).toHaveText('1 / 2');

  // Delete sits beside Done as a primary action; it opens a confirm popover first.
  await page.getByRole('button', { name: 'Delete Remember the milk' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click(); // confirm

  // The card is gone and the next slides in.
  await expect.poll(() => 'n1' in doc.current().nodes).toBe(false);
  await expect(page.getByRole('heading', { name: 'Second next' })).toBeVisible();
  await expect(page.getByLabel('Progress')).toHaveText('1 / 1');
});
