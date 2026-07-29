import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #980 — filtering Due down to zero rows must NOT remove the filter controls. Previously the panel
// early-returned a bare empty state, so once you filtered to empty you couldn't un-filter. The
// controls now stay, with a "filtered empty" message. Network-mocked.
test.use({
  seedDoc: new DocBuilder()
    .action('a', 'Pay the rent', { status: 'NEXT', dueAt: '2020-01-01' }) // long overdue
    .build(),
});

test('Due: filtering to empty keeps the status boxes reachable', async ({ page }) => {
  await page.goto('/due');
  await expect(page.getByText('Pay the rent')).toBeVisible();

  // Uncheck Next → the only due action is filtered out → the list is empty.
  await page.getByRole('checkbox', { name: 'Next' }).uncheck();
  await expect(page.getByText('Pay the rent')).toHaveCount(0);

  // The controls remain (the bug removed them), with a message that it's the filter's doing.
  await expect(page.getByText('Nothing due matches the current filter')).toBeVisible();
  const nextBox = page.getByRole('checkbox', { name: 'Next' });
  await expect(nextBox).toBeVisible();

  // Re-check Next → the action returns. You were never stranded.
  await nextBox.check();
  await expect(page.getByText('Pay the rent')).toBeVisible();
});
