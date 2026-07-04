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

  // Picking the other menu item while the panel is open switches tabs in place (#608).
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Account', exact: true }).click();
  await expect(panel.getByRole('tab', { name: 'Account' })).toHaveAttribute('aria-selected', 'true');

  // Escape aimed at an open dropdown dismisses just the dropdown — the panel stays (#608).
  await page.getByRole('button', { name: 'Account menu' }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(panel).toBeVisible();

  // Escape closes (park focus on empty main-area padding first — Esc inside a form control is
  // left to the control's own semantics).
  await page.getByRole('main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);

  // Reopen via the menu; the ✕ closes too.
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: 'Close settings' }).click();
  await expect(panel).toHaveCount(0);
});

test('the header and tab strip stay put while the tab body scrolls (#615)', async ({ page }) => {
  // A short viewport so the Preferences content overflows and the body has to scroll.
  await page.setViewportSize({ width: 1280, height: 400 });
  await page.goto('/inbox');
  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('menuitem', { name: 'Settings' }).click();
  const panel = page.getByRole('complementary', { name: 'Settings' });
  await expect(panel).toBeVisible();

  // Scroll the tab body to the bottom (the panel itself must not be the scroller).
  const lastControl = panel.locator('#settings-date-format').or(panel.getByRole('checkbox').last());
  await panel.getByRole('tabpanel').or(panel.locator('div.overflow-y-auto')).first().evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(lastControl.first()).toBeVisible();

  // The header row (with ✕) and the tab strip are still on screen and clickable.
  await expect(panel.getByRole('heading', { name: 'Settings' })).toBeInViewport();
  await expect(panel.getByRole('tab', { name: 'Preferences' })).toBeInViewport();
  const close = panel.getByRole('button', { name: 'Close settings' });
  await expect(close).toBeInViewport();
  await close.click();
  await expect(panel).toHaveCount(0);
});

test('the full /account page still works for direct links', async ({ page }) => {
  await page.goto('/account?tab=preferences');
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Preferences' })).toHaveAttribute('aria-selected', 'true');
});
