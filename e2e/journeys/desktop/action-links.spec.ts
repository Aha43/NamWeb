import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #658 — linked cards: a link to another action lives as a nam:// URI resource; the editor shows
// the target's live path, clicking it jumps to that action's editor, "…" re-picks, ✕ unlinks.
// Network-mocked.
test.use({
  seedDoc: new DocBuilder()
    .project('home', 'Home')
    .action('fix', 'Fix the door', { under: 'home', status: 'NEXT' })
    .action('paint', 'Paint the wall', { under: 'home', status: 'NEXT' })
    .build(),
});

test('link an action, follow the link, and unlink', async ({ page, doc }) => {
  await page.goto('/next');

  // Open "Fix the door" and link it to "Paint the wall" via the actions browser.
  await page.getByRole('button', { name: 'Edit Fix the door' }).click();
  const editor = page.getByRole('dialog', { name: 'Edit action' });
  await editor.getByRole('button', { name: 'Resources' }).click();
  await editor.getByRole('button', { name: 'Link action…' }).click();
  const picker = page.getByRole('dialog', { name: 'Link to action' });
  // Let the nested dialog's zoom-in animation finish before clicking rows (stability check).
  await expect
    .poll(() => picker.evaluate((el) => el.getAnimations().every((a) => a.playState === 'finished')))
    .toBe(true);
  await picker.getByRole('button', { name: 'Home', exact: true }).click();
  await picker.getByRole('button', { name: 'Paint the wall' }).click();
  await picker.getByRole('button', { name: 'Link', exact: true }).click();

  // The row shows the live breadcrumb path; Save persists the nam:// resource.
  await expect(editor.getByRole('button', { name: 'Open linked action Paint the wall' })).toHaveText(
    'Home › Paint the wall',
  );
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => doc.current().nodes['fix'].resources).toEqual([
    { type: 'URI', value: 'nam://action/paint', description: null },
  ]);

  // Follow the link: the editor swaps to the target action.
  await page.getByRole('button', { name: 'Edit Fix the door' }).click();
  await editor.getByRole('button', { name: 'Open linked action Paint the wall' }).click();
  await expect(editor.getByRole('textbox', { name: 'Title' })).toHaveValue('Paint the wall');
  await editor.getByRole('button', { name: 'Cancel' }).click();

  // Unlink: ✕ then Save empties the resources.
  await page.getByRole('button', { name: 'Edit Fix the door' }).click();
  await editor.getByRole('button', { name: 'Remove resource Paint the wall' }).click();
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => doc.current().nodes['fix'].resources).toEqual([]);
});
