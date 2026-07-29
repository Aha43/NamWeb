import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #981 — the Next view is just Next: no NEXT/BACKLOG/DONE status include-boxes (those belong on
// Contexts/Backlog/Due). The in-progress filter chip stays. Network-mocked.
test.use({
  seedDoc: new DocBuilder()
    .action('n1', 'Call the dentist', { status: 'NEXT' })
    .action('n2', 'Ship the invoice', { status: 'NEXT', tags: ['#in-progress'] })
    .action('b1', 'Someday idea', { status: 'BACKLOG' })
    .build(),
});

test('Next view: no status boxes, but the in-progress chip stays', async ({ page }) => {
  await page.goto('/next');

  // The Next list shows its NEXT actions and nothing from Backlog.
  await expect(page.getByText('Call the dentist')).toBeVisible();
  await expect(page.getByText('Ship the invoice')).toBeVisible();
  await expect(page.getByText('Someday idea')).toHaveCount(0);

  // No status include-boxes.
  await expect(page.getByRole('checkbox', { name: 'Next' })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Backlog' })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: 'Done' })).toHaveCount(0);

  // The in-progress chip remains and still filters.
  await page.getByRole('button', { name: 'Show in-progress only' }).click();
  await expect(page.getByText('Ship the invoice')).toBeVisible();
  await expect(page.getByText('Call the dentist')).toHaveCount(0);
});
