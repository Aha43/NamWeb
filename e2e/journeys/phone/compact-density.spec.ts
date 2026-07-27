import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #958 review — Compact density must shorten PHONE rows too. The phone row's height is set by its
// in-flow "…" overflow button; that button now shrinks in compact like the other controls. (Desktop
// is covered in desktop/display-presets.spec.ts.)
test.use({
  seedDoc: new DocBuilder().action('a1', 'Book flights', { status: 'NEXT' }).build(),
});

test('Compact density shortens phone action rows too', async ({ page }) => {
  const rowSel = () => page.locator('li').filter({ hasText: 'Book flights' }).first();

  await page.goto('/next');
  const before = (await rowSel().boundingBox())!.height;

  await page.goto('/account?tab=preferences');
  await page.getByRole('button', { name: 'Compact' }).click();
  await page.goto('/next');
  const after = (await rowSel().boundingBox())!.height;
  expect(after).toBeLessThan(before);
});
