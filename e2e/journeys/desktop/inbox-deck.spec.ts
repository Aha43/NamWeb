import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #648 — the one-at-a-time "Process inbox" deck cycles (Skip brings an item back around; the deck
// ends only when everything is resolved/deleted or you close it), and it honors the selection
// (Process selected (n) walks just the ticked items). Network-mocked.
test.use({
  seedDoc: new DocBuilder()
    .inbox('i1', 'First thought')
    .inbox('i2', 'Second thought')
    .inbox('i3', 'Third thought')
    .build(),
});

test('the deck cycles: skipped items come around again until resolved', async ({ page, doc }) => {
  await page.goto('/inbox');
  await page.getByRole('button', { name: 'Process inbox (3)' }).click();

  const dialog = page.getByRole('dialog', { name: 'Process inbox' });
  await expect(dialog).toBeVisible();
  // The "X of N" tells you which item you're on — so a roll-over past the end is visible (#866).
  await expect(dialog.getByText(/First thought · 1 of 3/)).toBeVisible();

  // The ←/→ arrow keys cycle the deck (#866) — the headline of this tweak: keyboard-only processing.
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByText(/Second thought · 2 of 3/)).toBeVisible();
  await page.keyboard.press('ArrowLeft'); // back to the first
  await expect(dialog.getByText(/First thought · 1 of 3/)).toBeVisible();

  // Skip past the end — the deck wraps instead of slamming shut, and the position rolls to 1.
  await dialog.getByRole('button', { name: /Skip/ }).click();
  await dialog.getByRole('button', { name: /Skip/ }).click();
  await expect(dialog.getByText(/Third thought · 3 of 3/)).toBeVisible();
  await dialog.getByRole('button', { name: /Skip/ }).click(); // wrap
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/First thought · 1 of 3/)).toBeVisible();

  // Resolving removes the item; the count drops and the next slides in.
  await dialog.getByRole('button', { name: 'It’s one action' }).click();
  await dialog.getByRole('button', { name: 'Do it next' }).click();
  await expect(dialog.getByText(/Second thought · 1 of 2/)).toBeVisible();
  await expect.poll(() => doc.current().nodes['i1'].status).toBe('NEXT');

  // Deleting also removes it; resolving the last one ends the deck.
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog.getByText(/Third thought · 1 of 1/)).toBeVisible();
  await dialog.getByRole('button', { name: 'It’s one action' }).click();
  await dialog.getByRole('button', { name: 'Park for later (backlog)' }).click();
  await expect(dialog).not.toBeVisible();
  await expect.poll(() => doc.current().nodes[doc.current().inboxNodeId].childIds).toEqual([]);
});

test('the deck honors the selection: Process selected walks only the ticked items', async ({ page, doc }) => {
  await page.goto('/inbox');
  await page.getByRole('button', { name: 'Select items' }).click();
  await page.getByRole('checkbox', { name: 'Select First thought' }).check();
  await page.getByRole('checkbox', { name: 'Select Third thought' }).check();

  // The Process button adapts to the selection; starting the deck leaves select mode.
  await page.getByRole('button', { name: 'Process selected (2)' }).click();
  await expect(page.getByText('2 selected')).toHaveCount(0);

  const dialog = page.getByRole('dialog', { name: 'Process inbox' });
  await expect(dialog.getByText(/First thought · 1 of 2/)).toBeVisible();
  await dialog.getByRole('button', { name: 'It’s one action' }).click();
  await dialog.getByRole('button', { name: 'Do it next' }).click();
  // Straight to the other selected item — the unselected one is not in the walk.
  await expect(dialog.getByText(/Third thought · 1 of 1/)).toBeVisible();
  await dialog.getByRole('button', { name: 'It’s one action' }).click();
  await dialog.getByRole('button', { name: 'Do it next' }).click();
  await expect(dialog).not.toBeVisible();

  // The unselected item is untouched inbox.
  await expect.poll(() => doc.current().nodes[doc.current().inboxNodeId].childIds).toEqual(['i2']);
  expect(doc.current().nodes['i1'].status).toBe('NEXT');
  expect(doc.current().nodes['i3'].status).toBe('NEXT');
});
