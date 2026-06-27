import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';
import { expandWorkbench } from '../../helpers/workbench';

// #425/#431 — desktop "move into a project" opens a quick menu of proximate targets (parent /
// siblings / Top level), with "Browse all projects…" opening the Finder-style column picker for
// anywhere else. Network-mocked.
test.use({
  seedDoc: new DocBuilder()
    .project('alpha', 'Alpha')
    .project('a1', 'Alpha child', { under: 'alpha' })
    .project('beta', 'Beta')
    .project('home', 'Home')
    .project('bath', 'Bathroom', { under: 'home' })
    .action('tidy', 'Tidy up', { under: 'home' })
    .project('work', 'Work')
    .build(),
});

test('quick-move a top-level project to a sibling via the menu (no dialog)', async ({ page, doc }) => {
  await page.goto('/projects');

  // Beta's siblings (other top-level projects) are one click in the quick menu — no picker dialog.
  await page.getByRole('button', { name: 'Move Beta into another project' }).click();
  await page.getByRole('menuitem', { name: 'Alpha', exact: true }).click();

  await expect.poll(() => doc.current().nodes['alpha'].childIds).toContain('beta');
  await expect(page.getByRole('dialog')).toHaveCount(0); // the column picker never opened
});

test('move a sub-project to a distant project via Browse → picker', async ({ page, doc }) => {
  await page.goto('/projects/home');
  await expandWorkbench(page);

  // Work isn't a sibling/parent of Bathroom, so reach it through Browse all projects… → picker.
  await page.getByRole('button', { name: 'Move Bathroom into another project' }).click();
  await page.getByRole('menuitem', { name: 'Browse all projects…' }).click();
  const picker = page.getByRole('dialog', { name: /Move "Bathroom" to/ });
  await picker.getByRole('button', { name: 'Work', exact: true }).click();
  await picker.getByRole('button', { name: 'Move here' }).click();

  await expect.poll(() => doc.current().nodes['work'].childIds).toContain('bath');
});

test('quick-move an action down into its project’s sub-project via the menu', async ({ page, doc }) => {
  await page.goto('/projects/home');
  await expandWorkbench(page);

  // "Tidy up" lives in Home; Home has sub-project Bathroom → it's a one-click "down" target.
  await page.getByRole('button', { name: 'Move Tidy up to another project' }).click();
  await page.getByRole('menuitem', { name: 'Bathroom', exact: true }).click();

  await expect.poll(() => doc.current().nodes['bath'].childIds).toContain('tidy');
  await expect(page.getByRole('dialog')).toHaveCount(0); // quick move — no picker dialog
});

test('create a new project from the Browse picker and move into it', async ({ page, doc }) => {
  await page.goto('/projects/home');
  await expandWorkbench(page);

  await page.getByRole('button', { name: 'Move Bathroom into another project' }).click();
  await page.getByRole('menuitem', { name: 'Browse all projects…' }).click();
  const picker = page.getByRole('dialog', { name: /Move "Bathroom" to/ });
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
