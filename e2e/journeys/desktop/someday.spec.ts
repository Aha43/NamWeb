import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #1131 — SOMEDAY: a commitment marker, not a timing one. A someday project and its whole subtree
// drop out of the day-to-day surfaces (Next/Backlog/Loose ends) and live only in the Someday view.
test.use({
  seedDoc: new DocBuilder()
    .project('trip', 'Trip to Japan', { status: 'SOMEDAY' })
    .action('book', 'Book flights', { under: 'trip', status: 'NEXT' })
    .action('call', 'Call the dentist', { status: 'NEXT' })
    .build(),
});

test('a someday project (and its children) stay out of Next; the Someday view lists it; promoting restores it', async ({ page, doc }) => {
  await page.goto('/next');
  await expect(page.getByText('Call the dentist')).toBeVisible(); // a free NEXT action stays
  await expect(page.getByText('Book flights')).toHaveCount(0); // a NEXT child of a someday project is suppressed

  await page.goto('/someday');
  await expect(page.getByRole('heading', { name: 'Someday' })).toBeVisible();
  await expect(page.getByText('Trip to Japan')).toBeVisible(); // the root — one row
  await expect(page.getByText('Book flights')).toHaveCount(0); // a descendant, not a someday root

  // Promote it (the happy path) → it leaves someday, and its NEXT child reappears in Next.
  await page.getByRole('button', { name: /Decide to do Trip to Japan/ }).click();
  await expect.poll(() => doc.current().nodes['trip'].status).toBe('NEXT');
  // The row is gone from the Someday view (the title still flashes in the undo toast, so assert the
  // row's own control is gone / the list is empty rather than a bare title match).
  await expect(page.getByRole('button', { name: /Decide to do Trip to Japan/ })).toHaveCount(0);
  await expect(page.getByText('Nothing parked')).toBeVisible();
  await page.goto('/next');
  await expect(page.getByText('Book flights')).toBeVisible(); // the child is no longer suppressed
});
