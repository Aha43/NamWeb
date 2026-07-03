import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #599 — Account/Settings opens in a resizable right panel beside the live workspace (desktop),
// so a preference change is observable as you flip it. ✕ and Escape close; the full /account
// page remains for phones and direct links.
test.use({ seedDoc: new DocBuilder().inbox('i1', 'Water plants').build() });

test('settings opens beside the live view, applies live, and closes via Esc and ✕', async ({ page }) => {
  await page.goto('/inbox');

  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();

  // The panel is open on Preferences — and the workspace is still live beside it.
  const panel = page.getByRole('complementary', { name: 'Settings' });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('tab', { name: 'Preferences' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Water plants')).toBeVisible(); // inbox stays on screen
  await expect(panel.getByRole('separator', { name: 'Resize settings panel' })).toHaveCount(0); // divider sits outside the panel
  await expect(page.getByRole('separator', { name: 'Resize settings panel' })).toBeVisible();

  // The point of the panel: watch a change land live — flip the language, the shell follows.
  // (By id: the panel's own accessible name translates too, so labels are moving targets here.)
  await page.locator('#settings-language').selectOption('nb');
  await expect(page.getByRole('link', { name: 'Etterslep' })).toBeVisible(); // Backlog, in Norwegian
  await page.locator('#settings-language').selectOption('en');
  await expect(page.getByRole('link', { name: 'Backlog' })).toBeVisible();

  // Escape closes (park focus on empty main-area padding first — Esc inside a form control is
  // left to the control's own semantics).
  await page.getByRole('main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);

  // Reopen on the Account tab via the menu; the ✕ closes too.
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Account', exact: true }).click();
  await expect(panel.getByRole('tab', { name: 'Account' })).toHaveAttribute('aria-selected', 'true');
  await panel.getByRole('button', { name: 'Close settings' }).click();
  await expect(panel).toHaveCount(0);
});

test('the full /account page still works for direct links', async ({ page }) => {
  await page.goto('/account?tab=preferences');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Preferences' })).toHaveAttribute('aria-selected', 'true');
});
