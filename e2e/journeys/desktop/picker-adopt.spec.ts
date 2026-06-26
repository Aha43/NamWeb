import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';
import { expandWorkbench } from '../../helpers/workbench';

// #425 — the Finder-style picker is adopted in the workbench + Projects-list "move into a project"
// controls (desktop). The folder icon opens the picker instead of an inline dropdown. Network-mocked.
test.use({
  seedDoc: new DocBuilder()
    .project('alpha', 'Alpha')
    .project('a1', 'Alpha child', { under: 'alpha' })
    .project('beta', 'Beta')
    .project('home', 'Home')
    .project('bath', 'Bathroom', { under: 'home' })
    .project('work', 'Work')
    .build(),
});

test('move a top-level project into another via the Projects-list picker', async ({ page, doc }) => {
  await page.goto('/projects');

  await page.getByRole('button', { name: 'Move Beta into another project' }).click();
  const picker = page.getByRole('dialog', { name: /Move "Beta" to/ });
  await picker.getByRole('button', { name: 'Alpha', exact: true }).click();
  await picker.getByRole('button', { name: 'Move here' }).click();

  await expect.poll(() => doc.current().nodes['alpha'].childIds).toContain('beta');
});

test('move a sub-project into another project via the workbench picker', async ({ page, doc }) => {
  await page.goto('/projects/home');
  await expandWorkbench(page);

  await page.getByRole('button', { name: 'Move Bathroom into another project' }).click();
  const picker = page.getByRole('dialog', { name: /Move "Bathroom" to/ });
  await picker.getByRole('button', { name: 'Work', exact: true }).click();
  await picker.getByRole('button', { name: 'Move here' }).click();

  await expect.poll(() => doc.current().nodes['work'].childIds).toContain('bath');
});

test('create a new project from the workbench picker and move into it', async ({ page, doc }) => {
  await page.goto('/projects/home');
  await expandWorkbench(page);

  await page.getByRole('button', { name: 'Move Bathroom into another project' }).click();
  const picker = page.getByRole('dialog', { name: /Move "Bathroom" to/ });
  // Create a brand-new top-level project and move Bathroom into it.
  await picker.getByRole('button', { name: /New project/ }).click();
  await page.getByLabel('New project name').fill('Renovations');
  await page.getByLabel('New project name').press('Enter');

  await expect
    .poll(() => {
      const d = doc.current();
      const proj = d.nodes[d.projectsNodeId].childIds.map((id) => d.nodes[id]).find((n) => n?.title === 'Renovations');
      return proj?.childIds ?? [];
    })
    .toContain('bath');
});
