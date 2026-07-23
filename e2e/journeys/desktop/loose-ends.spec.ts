import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #906 — "Loose ends": the always-on status overview. Composes the stalled-projects and gone-quiet
// lenses with drill-in, plus reference counts. DocBuilder stamps nodes at 2026-01-01, so any open
// action reads as "gone quiet"; an empty/next-less project reads as "stalled".
test.use({
  seedDoc: new DocBuilder()
    .project('p', 'Paint the shed') // no next action → stalled
    .action('a', 'Fix the gutter') // free NEXT action, old timestamp → gone quiet
    .inbox('i', 'A raw capture') // reference count: Inbox 1
    .build(),
});

test('Loose ends surfaces stalled projects + gone-quiet actions, with reference counts and drill-in', async ({ page }) => {
  await page.goto('/loose-ends');
  await expect(page.getByRole('heading', { name: 'Loose ends' })).toBeVisible();

  // Stalled: the next-less project is listed.
  await expect(page.getByRole('heading', { name: /Stalled projects/ })).toBeVisible();
  const stalled = page.getByRole('button', { name: 'Open Paint the shed' });
  await expect(stalled).toBeVisible();

  // Gone quiet: the old open action is listed.
  await expect(page.getByRole('heading', { name: /Gone quiet/ })).toBeVisible();
  await expect(page.getByText('Fix the gutter')).toBeVisible();

  // Reference counts link to their own homes.
  await expect(page.getByRole('link', { name: 'Inbox 1' })).toBeVisible();

  // Reachable from the sidebar, and drilling a stalled project opens its workbench.
  await expect(page.getByRole('link', { name: 'Loose ends' })).toBeVisible();
  await stalled.click();
  await expect(page).toHaveURL(/\/projects\/p$/);
});
