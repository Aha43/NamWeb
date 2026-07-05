import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #458/#641 — select several inbox items and triage them together via the shared processing
// wizard: Process… → destination (embedded Miller columns) → Next → status → Done. Network-mocked.
test.use({
  seedDoc: new DocBuilder()
    .project('home', 'Home')
    .inbox('i1', 'Buy tiles')
    .inbox('i2', 'Email Sam')
    .build(),
});

test('bulk-file selected inbox items as Next actions under a project (wizard)', async ({ page, doc }) => {
  await page.goto('/inbox');

  await page.getByRole('button', { name: 'Select items' }).click();
  await page.getByRole('button', { name: 'Select all' }).click();
  await page.getByRole('button', { name: 'Process…' }).click();

  // Destination step: the columns embedded on the page — no popup dialog.
  await expect(page.getByText('File selected items under…')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();

  // Status step → Done commits.
  await expect(page.getByText('2 selected → Home')).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click(); // the status option
  await page.getByRole('button', { name: 'Done' }).click();

  await expect.poll(() => doc.current().nodes['home'].childIds).toEqual(expect.arrayContaining(['i1', 'i2']));
  await expect.poll(() => doc.current().nodes['i1'].status).toBe('NEXT');
  await expect.poll(() => doc.current().nodes['i1'].project).toBe(false);
  await expect.poll(() => doc.current().nodes[doc.current().inboxNodeId].childIds).toEqual([]);
});

// #554/#641 — the wizard's destination step can create a project on the spot and file into it.
test('bulk-file selected inbox items under a project created in the wizard', async ({ page, doc }) => {
  await page.goto('/inbox');

  await page.getByRole('button', { name: 'Select items' }).click();
  await page.getByRole('button', { name: 'Select all' }).click();
  await page.getByRole('button', { name: 'Process…' }).click();

  // Create a new top-level project from within the embedded columns ("New project" prompt).
  await page.getByRole('button', { name: /New project/ }).click();
  await page.getByLabel('New project name').fill('Errands');
  await page.getByLabel('New project name').press('Enter');

  // Creating is a definitive pick → the wizard advances to the status step with it selected.
  await expect(page.getByText(/2 selected → .*Errands/)).toBeVisible();
  await page.getByRole('button', { name: 'Backlog', exact: true }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  const errandsId = () =>
    Object.values(doc.current().nodes).find((n) => n.title === 'Errands' && n.project)?.id;
  await expect.poll(errandsId).toBeTruthy();
  await expect.poll(() => doc.current().nodes[errandsId()!].childIds).toEqual(
    expect.arrayContaining(['i1', 'i2']),
  );
  await expect.poll(() => doc.current().nodes['i1'].status).toBe('BACKLOG');
});

test('bulk-make projects from selected inbox items (wizard)', async ({ page, doc }) => {
  await page.goto('/inbox');
  await page.getByRole('button', { name: 'Select items' }).click();
  await page.getByRole('button', { name: 'Select all' }).click();
  await page.getByRole('button', { name: 'Process…' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click(); // default destination
  await page.getByRole('button', { name: 'Make projects' }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  await expect.poll(() => doc.current().nodes['i1'].project).toBe(true);
  await expect.poll(() => doc.current().nodes['i2'].project).toBe(true);
  await expect.poll(() => doc.current().nodes[doc.current().projectsNodeId].childIds).toEqual(
    expect.arrayContaining(['i1', 'i2']),
  );
});
