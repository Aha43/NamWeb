import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #598 — Dense mode: hide the labels next to command-bar and sidebar icons (icons + tooltips
// suffice once you know the app); toggled in Preferences, watched live, persisted per device.
test.use({ seedDoc: new DocBuilder().project('vac', 'Vacation').build() });

test('dense mode strips labels live, keeps names accessible, and persists', async ({ page }) => {
  await page.goto('/account?tab=preferences');

  // Labelled by default: the command-bar Capture button and sidebar Backlog link show text.
  const capture = page.getByRole('button', { name: 'Capture', exact: true });
  const backlog = page.getByRole('link', { name: 'Backlog' });
  await expect(capture).toContainText('Capture');
  await expect(backlog).toContainText('Backlog');

  // Toggle dense → labels vanish live (this page stays open — the effect is visible immediately).
  await page.getByLabel(/Dense mode/).check();
  await expect(capture).not.toContainText('Capture');
  await expect(backlog).not.toContainText('Backlog');
  // Accessible names survive (aria-labels), so everything is still addressable — incl. this spec.
  await expect(page.getByRole('link', { name: 'Projects' })).toBeVisible();

  // Persists across a reload.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Capture', exact: true })).not.toContainText('Capture');

  // The NAM wordmark is gone in dense mode, so the logo is the only carrier of the
  // brand/version tooltip — hovering it must show "Next Action Master · v… · …" (#616).
  await page.getByRole('img', { name: 'Next Action Master' }).hover();
  await expect(page.getByRole('tooltip').filter({ hasText: /Next Action Master · v\d/ }).first()).toBeVisible();

  // And back off again.
  await page.getByLabel(/Dense mode/).uncheck();
  await expect(page.getByRole('link', { name: 'Backlog' })).toContainText('Backlog');
});
