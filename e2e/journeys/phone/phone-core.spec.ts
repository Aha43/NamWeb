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
