import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #604 — the desktop shell activates at 768px, but seven labelled command controls + search don't
// fit there. Below lg (1024px) the command-bar labels hide automatically (icons + tooltips +
// aria-labels carry them); the toolbar must never overflow horizontally.
test.use({
  seedDoc: new DocBuilder().project('vac', 'Vacation').build(),
  viewport: { width: 800, height: 720 },
});

test('near the shell breakpoint the command bar goes icon-only and nothing overflows', async ({ page }) => {
  await page.goto('/inbox');

  // Labels are hidden at this width (CSS, still in the DOM) — every control keeps its
  // accessible name via aria-label.
  const capture = page.getByRole('button', { name: 'Capture', exact: true });
  await expect(capture).toBeVisible();
  await expect(capture.getByText('Capture')).toBeHidden();
  await expect(page.getByRole('link', { name: 'Projects' })).toBeVisible();

  // The header row itself must not overflow horizontally.
  const overflow = await page.evaluate(() => {
    const header = document.querySelector('header')!;
    return header.scrollWidth - header.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
});
