import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #458 — select several inbox items and triage them together via the inline bulk bar (one shared
// decision: kind + status + file-under). Network-mocked.
test.use({
  seedDoc: new DocBuilder()
    .project('home', 'Home')
    .inbox('i1', 'Buy tiles')
    .inbox('i2', 'Email Sam')
    .build(),
});

test('bulk-file selected inbox items as Next actions under a project', async ({ page, doc }) => {
  await page.goto('/inbox');

  await page.getByRole('button', { name: 'Select items' }).click();
  await page.getByRole('button', { name: 'Select all' }).click();

  // Choose a destination project for the batch.
  await page.getByRole('button', { name: /File into/ }).click();
  const picker = page.getByRole('dialog', { name: 'File selected items under…' });
  await picker.getByRole('button', { name: 'Home', exact: true }).click();
  await picker.getByRole('button', { name: 'Choose' }).click();

  // The "File into" chip shows the destination; the verb just commits.
  await page.getByRole('button', { name: '→ Next' }).click();

  await expect.poll(() => doc.current().nodes['home'].childIds).toEqual(expect.arrayContaining(['i1', 'i2']));
  await expect.poll(() => doc.current().nodes['i1'].status).toBe('NEXT');
  await expect.poll(() => doc.current().nodes['i1'].project).toBe(false);
  await expect.poll(() => doc.current().nodes[doc.current().inboxNodeId].childIds).toEqual([]);
});

// #554 — the bulk "File under" picker can now create a project on the spot and file into it.
test('bulk-file selected inbox items under a project created from the picker', async ({ page, doc }) => {
  await page.goto('/inbox');

  await page.getByRole('button', { name: 'Select items' }).click();
  await page.getByRole('button', { name: 'Select all' }).click();

  await page.getByRole('button', { name: /File into/ }).click();
  const picker = page.getByRole('dialog', { name: 'File selected items under…' });

  // Create a new top-level project from within the picker (the newly-wired "＋ New project" affordance).
  await picker.getByRole('button', { name: /New project/ }).click();
  // The PromptButton popover portals to <body>; its input is a combobox, so target it by label.
  await page.getByLabel('New project name').fill('Errands');
  await page.getByLabel('New project name').press('Enter');

  // Creating closes the picker and sets the batch destination to the new project; the verb commits.
  await page.getByRole('button', { name: '→ Next' }).click();

  const errandsId = () =>
    Object.values(doc.current().nodes).find((n) => n.title === 'Errands' && n.project)?.id;
  await expect.poll(errandsId).toBeTruthy();
  await expect.poll(() => doc.current().nodes[errandsId()!].childIds).toEqual(
    expect.arrayContaining(['i1', 'i2']),
  );
  await expect.poll(() => doc.current().nodes['i1'].status).toBe('NEXT');
  await expect.poll(() => doc.current().nodes[doc.current().inboxNodeId].childIds).toEqual([]);
});

test('bulk-make projects from selected inbox items', async ({ page, doc }) => {
  await page.goto('/inbox');
  await page.getByRole('button', { name: 'Select items' }).click();
  await page.getByRole('button', { name: 'Select all' }).click();
  await page.getByRole('button', { name: 'Make projects' }).click();

  await expect.poll(() => doc.current().nodes['i1'].project).toBe(true);
  await expect.poll(() => doc.current().nodes['i2'].project).toBe(true);
  await expect.poll(() => doc.current().nodes[doc.current().projectsNodeId].childIds).toEqual(
    expect.arrayContaining(['i1', 'i2']),
  );
});
