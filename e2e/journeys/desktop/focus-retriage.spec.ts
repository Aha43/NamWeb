import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #277 — re-triage in Focus mode: defer a Next to Backlog (and promote a Backlog to Next) in-flow,
// without leaving the deck. The flipped card drops out of the current queue and the next slides in.
// Network-mocked.
test.use({
  seedDoc: new DocBuilder()
    .action('n1', 'First next', { status: 'NEXT' })
    .action('n2', 'Second next', { status: 'NEXT' })
    .action('b1', 'A backlog item', { status: 'BACKLOG' })
    .build(),
});

test('defer a Next to Backlog from the focus deck', async ({ page, doc }) => {
  await page.goto('/focus'); // defaults to the Next queue

  await expect(page.getByRole('heading', { name: 'First next' })).toBeVisible();
  await expect(page.getByLabel('Progress')).toHaveText('1 / 2');

  await page.getByRole('button', { name: 'Move to Backlog' }).click();

  // The card is re-triaged and drops out of the deck; the next card slides in.
  await expect.poll(() => doc.current().nodes['n1'].status).toBe('BACKLOG');
  await expect(page.getByRole('heading', { name: 'Second next' })).toBeVisible();
  await expect(page.getByLabel('Progress')).toHaveText('1 / 1');
});

test('promote a Backlog item to Next from the focus deck', async ({ page, doc }) => {
  await page.goto('/focus?source=backlog');

  await expect(page.getByRole('heading', { name: 'A backlog item' })).toBeVisible();
  await page.getByRole('button', { name: 'Move to Next' }).click();

  await expect.poll(() => doc.current().nodes['b1'].status).toBe('NEXT');
  await expect(page.getByText('All clear 🎉')).toBeVisible(); // backlog queue now empty
});
