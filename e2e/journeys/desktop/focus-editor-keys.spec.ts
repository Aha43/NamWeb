import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #614 — the focus deck's key handler must go quiet while the action editor is open. Before the
// fix, with dialog focus on any non-input element, `e` swapped the open editor to the deck's
// current card, arrows rotated the deck, Space marked the deck's card done behind the dialog,
// and Escape exited Focus along with (or instead of) the dialog. Network-mocked.
test.use({
  seedDoc: new DocBuilder()
    .action('n1', 'First next', { status: 'NEXT' })
    .action('n2', 'Second next', { status: 'NEXT' })
    .action('n3', 'Third next', { status: 'NEXT' })
    .build(),
});

test('deck keys do not fire behind the open action editor', async ({ page, doc }) => {
  await page.goto('/focus');
  await expect(page.getByRole('heading', { name: 'First next' })).toBeVisible();

  // Open the editor for the current card via the keyboard.
  await page.keyboard.press('e');
  const dialog = page.getByRole('dialog', { name: 'Edit action' });
  await expect(dialog).toBeVisible();
  const title = dialog.getByRole('textbox', { name: 'Title' });
  // The opening `e` keystroke must not leak into the autofocused title field.
  await expect(title).toHaveValue('First next');

  // Park focus on a button (not an input) — the exact state that used to leak keys to the deck.
  await dialog.getByRole('button', { name: 'Save' }).focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('e');
  await page.keyboard.press('ArrowLeft');

  // The dialog still shows the card we opened — it must not swap to another action.
  await expect(title).toHaveValue('First next');

  // Escape while focus sits on a button must close the editor but NOT also exit Focus.
  // (Focus the tooltip-less Delete button: Save/Cancel carry tooltips, which are dismissable
  // layers of their own and would swallow the first Escape — Radix layering, not ours to test.)
  await dialog.getByRole('button', { name: 'Delete', exact: true }).focus();
  // Wait out the Save tooltip's exit animation — while mounted it is the topmost layer and
  // would swallow the Escape itself.
  await expect(page.locator('[data-radix-popper-content-wrapper]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/\/focus/);
  await expect(page.getByRole('heading', { name: 'First next' })).toBeVisible();
  await expect(page.getByLabel('Progress')).toHaveText('1 / 3');

  // Space on a dialog button keeps its native meaning (activate the button) — before the fix the
  // deck intercepted it and marked the deck's card done behind the dialog.
  await page.keyboard.press('e');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Save' }).focus();
  await page.keyboard.press('Space');
  await expect(dialog).not.toBeVisible(); // Space activated Save (a no-edit save closes the dialog)
  expect(doc.current().nodes['n1'].status).toBe('NEXT');
  expect(doc.current().nodes['n2'].status).toBe('NEXT');
  await expect(page.getByRole('heading', { name: 'First next' })).toBeVisible();
});
