import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #423 — on phone the Action editor keeps the lightweight native "Move to" select (no column picker).
// Verify that move path still works (no regression). Network-mocked.
test.use({
  seedDoc: new DocBuilder()
    .project('home', 'Home Reno')
    .action('tiles', 'Buy tiles')
    .build(),
});

test('move an action via the native select on phone', async ({ page, doc }) => {
  await page.goto('/next');

  await page.getByRole('button', { name: 'Edit Buy tiles' }).click();
  await page.getByRole('button', { name: 'Move / make project' }).click();

  // Phone shows the native <select>, not the "Move to…" picker button.
  await expect(page.getByRole('button', { name: 'Move to…' })).toHaveCount(0);
  await page.getByLabel('Move to').selectOption('home');

  await expect.poll(() => doc.current().nodes['home'].childIds).toContain('tiles');
});
