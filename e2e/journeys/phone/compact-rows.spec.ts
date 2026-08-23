import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #1185 — Compact rows must shorten PHONE rows too. The phone row's height is set by its in-flow "…"
// overflow button; that button shrinks in compact like the other controls. (Desktop is covered in
// desktop/display-presets.spec.ts.)
test.use({
  seedDoc: new DocBuilder().action('a1', 'Book flights', { status: 'NEXT' }).build(),
});

test('the compact-rows toggle shortens phone action rows too', async ({ page }) => {
  const rowSel = () => page.locator('li').filter({ hasText: 'Book flights' }).first();

  await page.goto('/next');
  const before = (await rowSel().boundingBox())!.height;

  // On phone the rows toggle lives inside the collapsed Filter disclosure — open it first.
  await page.getByRole('button', { name: 'Filter', exact: true }).click();
  await page.getByRole('button', { name: 'Compact rows' }).click();
  const after = (await rowSel().boundingBox())!.height;
  expect(after).toBeLessThan(before);
});
