import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #623 — the capture dialog as a processing station: a streak often lands in one domain and you
// already know how to triage it — select rows, pick where + status, done. Same intents and toolbar
// verbs as inbox bulk triage (#458); processed rows stay listed with a ✓-marker. Network-mocked.
test.use({
  seedDoc: new DocBuilder().project('home', 'Home').build(),
});

test('select just-captured items, file them under a project as Next', async ({ page, doc }) => {
  await page.goto('/inbox');
  await page.getByRole('button', { name: 'Capture', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Capture' });
  const field = dialog.getByLabel('Capture to inbox');
  for (const title of ['fix gutter', 'paint fence', 'unrelated thought']) {
    await field.fill(title);
    await field.press('Enter');
  }

  // Select the two Home-domain captures.
  await dialog.getByRole('button', { name: 'Select items' }).click();
  await dialog.getByRole('checkbox', { name: 'Select fix gutter' }).check();
  await dialog.getByRole('checkbox', { name: 'Select paint fence' }).check();
  await expect(dialog.getByText('2 selected')).toBeVisible();

  // Pick the destination in the nested column picker, then send them → Next.
  await dialog.getByRole('button', { name: /File into/ }).click();
  const picker = page.getByRole('dialog', { name: 'File selected items under…' });
  await picker.getByRole('button', { name: 'Home', exact: true }).click();
  await picker.getByRole('button', { name: 'Choose' }).click();
  await expect(picker).not.toBeVisible();
  await expect(dialog).toBeVisible(); // the capture dialog survived the nested picker
  await dialog.getByRole('button', { name: '→ Next' }).click();

  // The document moved both under Home with status NEXT; the third capture is untouched inbox.
  // (Poll for BOTH — the two conversions can land in separate sync pushes.)
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

  // Processed rows stay listed with the ✓ destination marker; the third stays selectable.
  const list = dialog.getByRole('list');
  await expect(list.getByRole('listitem')).toHaveCount(3);
  await expect(list.getByText('Next · Home').first()).toBeVisible();
  await expect(dialog.getByRole('checkbox', { name: 'Select fix gutter' })).toHaveCount(0);
  await expect(dialog.getByRole('checkbox', { name: 'Select unrelated thought' })).toBeVisible();

  // The leftover goes to Backlog — the destination chip persists (still Home), like inbox triage.
  await dialog.getByRole('checkbox', { name: 'Select unrelated thought' }).check();
  await dialog.getByRole('button', { name: '→ Backlog' }).click();
  await expect.poll(() => {
    const n = Object.values(doc.current().nodes).find((x) => x.title === 'unrelated thought');
    return n?.status;
  }).toBe('BACKLOG');
  await expect(list.getByText('Backlog · Home')).toBeVisible();
});

test('Make projects and bulk delete with grouped undo, from the capture list', async ({ page, doc }) => {
  await page.goto('/inbox');
  await page.getByRole('button', { name: 'Capture', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Capture' });
  const field = dialog.getByLabel('Capture to inbox');
  for (const title of ['big initiative', 'noise 1', 'noise 2']) {
    await field.fill(title);
    await field.press('Enter');
  }
  await dialog.getByRole('button', { name: 'Select items' }).click();

  // One becomes a project…
  await dialog.getByRole('checkbox', { name: 'Select big initiative' }).check();
  await dialog.getByRole('button', { name: 'Make projects' }).click();
  await expect.poll(() => {
    const n = Object.values(doc.current().nodes).find((x) => x.title === 'big initiative');
    return n?.project;
  }).toBe(true);
  await expect(dialog.getByText('Project', { exact: true })).toBeVisible();

  // …the noise gets bulk-deleted (confirm), then one grouped Undo brings it back.
  await dialog.getByRole('button', { name: 'Select all' }).click();
  await expect(dialog.getByText('2 selected')).toBeVisible(); // the processed row is not selectable
  await dialog.getByRole('button', { name: 'Delete selected items' }).click();
  // The confirm popover portals outside the dialog element — query it at page level.
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog.getByRole('list').getByText('noise 1')).toHaveCount(0);
  await page.locator('[role="status"] button', { hasText: 'Undo' }).click();
  await expect(dialog).toBeVisible(); // toast click doesn't close the capture dialog
  await expect(dialog.getByRole('list').getByText('noise 1')).toBeVisible();
  await expect(dialog.getByRole('list').getByText('noise 2')).toBeVisible();
});
