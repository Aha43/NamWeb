import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #623/#635 — the capture dialog as a processing station, wizard-style: select just-captured rows,
// hit Process…, pick a destination in the embedded Miller columns, Next → choose a status, Done.
// Same intents as inbox bulk triage; processed rows stay listed with a ✓-marker. Network-mocked.
test.use({
  seedDoc: new DocBuilder().project('home', 'Home').build(),
});

test('wizard: select captures, file them under a project as Next', async ({ page, doc }) => {
  await page.goto('/inbox');
  await page.getByRole('button', { name: 'Capture', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Capture' });
  const field = dialog.getByLabel('Capture to inbox');
  for (const title of ['fix gutter', 'paint fence', 'unrelated thought']) {
    await field.fill(title);
    await field.press('Enter');
  }

  // Select the two Home-domain captures and start the wizard.
  await dialog.getByRole('button', { name: 'Select items' }).click();
  await dialog.getByRole('checkbox', { name: 'Select fix gutter' }).check();
  await dialog.getByRole('checkbox', { name: 'Select paint fence' }).check();
  await expect(dialog.getByText('2 selected')).toBeVisible();
  await dialog.getByRole('button', { name: 'Process…' }).click();

  // Destination step: the Miller columns are embedded in the dialog — no nested popup.
  await expect(dialog.getByText('File selected items under…')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'File selected items under…' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Home', exact: true }).click();
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();

  // Status step: choose, then Done commits.
  await expect(dialog.getByText('What should they become?')).toBeVisible();
  await expect(dialog.getByText('2 selected → Home')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Done' })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Next', exact: true }).click(); // the status option
  await dialog.getByRole('button', { name: 'Done' }).click();

  // Both moved under Home as NEXT; the third capture is untouched inbox.
  await expect.poll(() => {
    const nodes = doc.current().nodes;
    const converted = ['fix gutter', 'paint fence'].map((t) =>
      Object.values(nodes).find((n) => n.title === t),
    );
    return converted.every((n) => n && n.status === 'NEXT' && nodes['home'].childIds.includes(n.id));
  }).toBe(true);
  const nodes = doc.current().nodes;
  const stray = Object.values(nodes).find((n) => n.title === 'unrelated thought')!;
  expect(nodes[doc.current().inboxNodeId].childIds).toContain(stray.id);

  // The wizard folded away: list is back, processed rows marked, the third still selectable.
  const list = dialog.getByRole('list');
  await expect(list.getByRole('listitem')).toHaveCount(3);
  await expect(list.getByText('Next · Home').first()).toBeVisible();
  await expect(dialog.getByRole('checkbox', { name: 'Select fix gutter' })).toHaveCount(0);
  await expect(dialog.getByRole('checkbox', { name: 'Select unrelated thought' })).toBeVisible();
});

test('wizard: Back and Cancel navigate without committing; Make projects and bulk delete still work', async ({ page, doc }) => {
  await page.goto('/inbox');
  await page.getByRole('button', { name: 'Capture', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Capture' });
  const field = dialog.getByLabel('Capture to inbox');
  for (const title of ['big initiative', 'noise 1', 'noise 2']) {
    await field.fill(title);
    await field.press('Enter');
  }
  await dialog.getByRole('button', { name: 'Select items' }).click();

  // Wizard navigation: in, forward, Back, Cancel — nothing committed, selection intact.
  await dialog.getByRole('checkbox', { name: 'Select big initiative' }).check();
  await dialog.getByRole('button', { name: 'Process…' }).click();
  await dialog.getByRole('button', { name: 'Next', exact: true }).click(); // default destination preselected
  await dialog.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(dialog.getByText('File selected items under…')).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog.getByText('1 selected')).toBeVisible();

  // Make it a project via the wizard (default destination = top level).
  await dialog.getByRole('button', { name: 'Process…' }).click();
  await dialog.getByRole('button', { name: 'Next', exact: true }).click();
  await dialog.getByRole('button', { name: 'Make projects' }).click();
  await dialog.getByRole('button', { name: 'Done' }).click();
  await expect.poll(() => {
    const n = Object.values(doc.current().nodes).find((x) => x.title === 'big initiative');
    return n?.project;
  }).toBe(true);
  await expect(dialog.getByText('Project', { exact: true })).toBeVisible();

  // Bulk delete (still on the select bar) with one grouped Undo; toast click keeps the dialog open.
  await dialog.getByRole('button', { name: 'Select all' }).click();
  await expect(dialog.getByText('2 selected')).toBeVisible(); // the processed row is not selectable
  await dialog.getByRole('button', { name: 'Delete selected items' }).click();
  // The confirm popover portals outside the dialog element — query it at page level.
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog.getByRole('list').getByText('noise 1')).toHaveCount(0);
  await page.locator('[role="status"] button', { hasText: 'Undo' }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('list').getByText('noise 1')).toBeVisible();
  await expect(dialog.getByRole('list').getByText('noise 2')).toBeVisible();
});
