import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #1008 — the inbox count must show on the dense-mode sidebar icon (a corner badge), not just the
// red glow. Non-dense keeps its inline badge. Network-mocked.
test.use({
  seedDoc: new DocBuilder().inbox('i1', 'One').inbox('i2', 'Two').build(),
});

test('dense sidebar shows the inbox count on the icon', async ({ page }) => {
  await page.goto('/account?tab=preferences');
  const inbox = page.getByRole('link', { name: 'Inbox' });

  // Non-dense: the count shows inline.
  await expect(inbox.getByText('2')).toBeVisible();

  // Dense: labels vanish, but the count rides the icon as a corner badge.
  await page.getByLabel(/Dense mode/).check();
  await expect(inbox).not.toContainText('Inbox');
  await expect(inbox.getByText('2')).toBeVisible();
  await expect(page.getByLabel('2 unprocessed')).toBeVisible();
});
