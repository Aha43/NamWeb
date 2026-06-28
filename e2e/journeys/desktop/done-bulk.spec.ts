import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #460 — Select all in the Done view's select mode, then bulk-act on everything (here: restore).
// Network-mocked.
test.use({
  seedDoc: new DocBuilder()
    .action('d1', 'Wash car', { status: 'DONE' })
    .action('d2', 'Pay bill', { status: 'DONE' })
    .build(),
});

test('select all done actions and bulk-restore them', async ({ page, doc }) => {
  await page.goto('/done');
  await expect(page.getByText('Wash car')).toBeVisible();
  await expect(page.getByText('Pay bill')).toBeVisible();

  await page.getByRole('button', { name: 'Select actions' }).click();
  await page.getByRole('button', { name: 'Select all' }).click();
  await page.getByRole('button', { name: 'Restore to Next' }).click();

  // Both left Done (now NEXT).
  await expect(page.getByText('Wash car')).toHaveCount(0);
  await expect.poll(() => doc.current().nodes['d1'].status).toBe('NEXT');
  await expect.poll(() => doc.current().nodes['d2'].status).toBe('NEXT');
});
