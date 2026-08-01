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

// #988 review (P2) — a bulk status change that empties the visible Due rows (setting them Done, which
// the default boxes exclude) must NOT trap you in select mode: the select toggle / bulk bar stay.
test('Due: a bulk set-to-Done that empties the list leaves select mode escapable', async ({ page }) => {
  await page.goto('/due');
  await expect(page.getByText('Pay the rent')).toBeVisible();

  await page.getByRole('button', { name: 'Select' }).click();
  await page.getByRole('checkbox', { name: 'Select Pay the rent' }).check();

  // Set the only visible row to Done → it leaves the Due set (Done off by default) → zero rows.
  await page.getByRole('button', { name: 'Status ▾' }).click();
  await page.getByRole('menuitem', { name: 'Done' }).click();
  // The list is now empty (the row's title lingers only in the status-change undo toast).
  await expect(page.getByText('Nothing due', { exact: true })).toBeVisible();

  // Not trapped: the select toggle stays, so you can leave select mode.
  const exit = page.getByRole('button', { name: 'Exit select' });
  await expect(exit).toBeVisible();
  await exit.click();
  // Left select mode cleanly (the empty view then drops to its bare state, no controls — #980).
  await expect(page.getByRole('button', { name: 'Exit select' })).toHaveCount(0);
});
