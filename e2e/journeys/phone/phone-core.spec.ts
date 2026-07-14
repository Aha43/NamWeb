import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// J1 — the phone form factor, which had zero coverage. Runs on the iPhone 13 viewport so the
// PhoneShell renders: the front-and-center Capture button, the bottom-bar Focus action, and
// the More sheet that holds every other surface. Network-mocked (no backend).
test.use({ seedDoc: new DocBuilder().action('a1', 'Call the plumber').build() });

test.describe('phone shell core loop', () => {
  test('capture from the bottom bar lands in the inbox', async ({ page }) => {
    await page.goto('/inbox');

    // The headline action: the round Capture button opens the capture sheet.
    await page.getByRole('button', { name: 'Capture' }).click();
    const sheet = page.getByRole('dialog');
    await sheet.getByLabel('Capture to inbox').fill('Buy milk');
    await sheet.getByLabel('Capture to inbox').press('Enter'); // no Add button — Enter/Go submits (#626)

    // The sheet stays open for rapid capture; dismiss it, then confirm it reached the inbox.
    await page.keyboard.press('Escape');
    await expect(page.getByText('Buy milk')).toBeVisible();
  });

  test('row controls hide behind the per-row reveal — titles get the width (#776)', async ({ page }) => {
    await page.goto('/next');
    // Await the ROW first: a zero-element locator makes toBeHidden pass vacuously — this spec
    // was green by losing a race until #786 (it probed 'Edit {title}', the always-visible
    // title button, not a strip control). Playwright's getByRole excludes display:none nodes
    // from the a11y tree, so hidden-strip assertions must name controls that live IN the strip.
    const reveal = page.getByRole('button', { name: 'Show actions for Call the plumber' });
    await expect(reveal).toBeVisible();
    // The strip is invisible until asked…
    await expect(page.getByRole('button', { name: 'Rename Call the plumber' })).toBeHidden();
    // …the reveal shows it, full-width on its own line…
    await reveal.click();
    await expect(page.getByRole('button', { name: 'Rename Call the plumber' })).toBeVisible();
    // …and the controls actually work from there (the title-tap Edit stays outside the strip).
    await page.getByRole('button', { name: 'Edit Call the plumber' }).click();
    await expect(page.getByRole('dialog').getByText('Edit action')).toBeVisible();
  });

  test('focus action and More-sheet navigation', async ({ page }) => {
    await page.goto('/inbox');

    // Bottom-bar Focus.
    await page.getByRole('link', { name: 'Focus' }).click();
    await expect(page).toHaveURL(/\/focus$/);

    // Everything else lives behind More.
    await page.goto('/inbox');
    await page.getByRole('button', { name: 'More' }).click();
    const moreNav = page.getByRole('navigation', { name: 'More' });
    await moreNav.getByRole('link', { name: 'Backlog' }).click();
    await expect(page).toHaveURL(/\/backlog$/);
  });
});
