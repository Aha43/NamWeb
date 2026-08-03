import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';
import { expandWorkbench } from '../../helpers/workbench';

// #1023 — system tags are managed as **Features**: a checkbox + description dialog, opened from the
// project workbench header and the action editor, instead of hunting for a `#`-tag. Network-mocked;
// the demo has no shares, so only the non-`#shared-*` features (In progress / Intentionally
// next-less) show here — exactly what a signed-out surface should see.
test.use({
  seedDoc: new DocBuilder()
    .project('proj', 'Kitchen reno')
    .action('act', 'Measure the wall', { under: 'proj' })
    .build(),
});

test('toggle a project feature from the workbench header (dispatches straight away)', async ({ page, doc }) => {
  await page.goto('/projects/proj');

  await page.getByRole('button', { name: 'Features' }).click();
  const notStalled = page.getByRole('checkbox', { name: /intentionally next-less/i });
  await expect(notStalled).not.toBeChecked();
  // A project not in a share never offers the #shared-* grammar.
  await expect(page.getByRole('checkbox', { name: /hidden from share/i })).toHaveCount(0);

  await notStalled.check();
  await expect.poll(() => doc.current().nodes['proj'].tags).toContain('#not-stalled');
});

test('toggle an action feature from the editor (saves with the buffer)', async ({ page, doc }) => {
  await page.goto('/projects/proj');
  await expandWorkbench(page);

  // Open the action editor; scope to it so its "Features" button isn't confused with the header's.
  await page.getByRole('button', { name: 'Edit Measure the wall' }).click();
  const editor = page.getByRole('dialog').filter({ hasText: 'Edit action' });
  await editor.getByRole('button', { name: 'Features' }).click();
  await page.getByRole('checkbox', { name: /in progress/i }).check();
  // Editor buffer — nothing persists until Save.
  await expect.poll(() => doc.current().nodes['act'].tags).not.toContain('#in-progress');
  // Close the Features layer, then Save the editor to commit the buffered tag.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('checkbox', { name: /in progress/i })).toHaveCount(0);
  await editor.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => doc.current().nodes['act'].tags).toContain('#in-progress');
});
