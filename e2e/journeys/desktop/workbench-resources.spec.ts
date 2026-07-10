import { test, expect, type Locator } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';
import { expandWorkbench } from '../../helpers/workbench';

// #87 (Workspace parity, phase 5) — attach a resource (link) to an action via the editor; the row
// then shows a paperclip and the resource persists. Since #720 create/edit happen in a dialog.
test.use({
  seedDoc: new DocBuilder().project('proj', 'Project').action('a1', 'Read the spec', { under: 'proj' }).build(),
});

/** Let a freshly-opened dialog's zoom-in animation finish before clicking inside it — a click
 *  landing mid-zoom can miss the moving content and hit the overlay (which closes the dialog). */
async function settled(dialog: Locator) {
  await expect
    .poll(() => dialog.evaluate((el) => el.getAnimations().every((a) => a.playState === 'finished')))
    .toBe(true);
}

test('add a resource via the dialog; edit it in place; the row shows a paperclip', async ({ page, doc }) => {
  await page.goto('/projects/proj');
  await expandWorkbench(page);

  await page.getByRole('button', { name: 'Edit Read the spec' }).click();
  const dialog = page.getByRole('dialog', { name: 'Edit action' });
  await settled(dialog);
  await dialog.getByRole('button', { name: 'Resources' }).click(); // expand the collapsed section

  // Create in the resource dialog (#720) — with a display name (#715).
  await dialog.getByRole('button', { name: 'Add resource…' }).click();
  const resourceDialog = page.getByRole('dialog', { name: 'Add resource' });
  await settled(resourceDialog);
  await resourceDialog.getByLabel('Resource value').fill('https://spec.test');
  await resourceDialog.getByLabel('Link name (optional)').fill('The spec');
  await resourceDialog.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(dialog.getByRole('link', { name: 'The spec' })).toBeVisible();

  // Edit via the row's "…" — fix the name.
  await dialog.getByRole('button', { name: 'Edit resource The spec' }).click();
  const editDialog = page.getByRole('dialog', { name: 'Edit resource' });
  await settled(editDialog);
  await expect(editDialog.getByLabel('Resource value')).toHaveValue('https://spec.test');
  await editDialog.getByLabel('Link name (optional)').fill('The real spec');
  await editDialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByRole('link', { name: 'The real spec' })).toBeVisible();

  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByLabel('Has resources')).toBeVisible();
  await expect.poll(() => doc.current().nodes['a1'].resources).toEqual([
    { type: 'URI', value: 'https://spec.test', description: 'The real spec' },
  ]);
});
