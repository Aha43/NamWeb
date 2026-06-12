import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #39 — hand-order Next actions with up/down (manual order, the "Unsorted" mode), persisted to
// the workspace document's viewOrders. Network-mocked.
test.use({
  seedDoc: new DocBuilder()
    .action('n1', 'Alpha')
    .action('n2', 'Beta')
    .action('n3', 'Gamma')
    .build(),
});

test('reorder Next actions up/down, persisted to the workspace', async ({ page, doc }) => {
  await page.goto('/next');
  const items = page.getByRole('list').getByRole('listitem');
  await expect(items).toHaveText([/Alpha/, /Beta/, /Gamma/]);

  // Move Alpha down → Beta, Alpha, Gamma.
  await page.getByRole('button', { name: 'Move Alpha down' }).click();
  await expect(items).toHaveText([/Beta/, /Alpha/, /Gamma/]);

  // The new order is persisted to the (mocked) workspace document.
  await expect.poll(() => doc.current().viewOrders['next']).toEqual(['n2', 'n1', 'n3']);

  // Move Gamma up → Beta, Gamma, Alpha.
  await page.getByRole('button', { name: 'Move Gamma up' }).click();
  await expect(items).toHaveText([/Beta/, /Gamma/, /Alpha/]);
});
