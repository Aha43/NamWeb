import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';
import { expandWorkbench } from '../../helpers/workbench';

// #1009 — the per-row move-to menu groups its destinations under quiet section headers (Parent /
// Sibling / Sub-project / Top level · Free actions). Project names are kept distinct from the headers
// so the assertions are unambiguous. Network-mocked.
test.use({
  seedDoc: new DocBuilder()
    .project('reno', 'Home Reno')
    .project('kitchen', 'Kitchen', { under: 'reno' })
    .project('bath', 'Bathroom', { under: 'reno' }) // a sibling of Kitchen
    .action('act', 'Buy tiles', { status: 'NEXT', under: 'kitchen' })
    .build(),
});

test('the move-to menu labels its sections', async ({ page }) => {
  await page.goto('/projects/kitchen');
  await expandWorkbench(page);

  await page.getByRole('button', { name: 'Move Buy tiles to another project' }).click();
  const menu = page.getByRole('menu');

  // Quiet section headers categorize the proximate destinations.
  await expect(menu.getByText('Parent')).toBeVisible();
  await expect(menu.getByText('Sibling')).toBeVisible();
  await expect(menu.getByText('Top level · Free actions')).toBeVisible();
  // …with the actual projects listed under them.
  await expect(menu.getByRole('menuitem', { name: 'Home Reno' })).toBeVisible(); // parent
  await expect(menu.getByRole('menuitem', { name: 'Bathroom' })).toBeVisible(); // sibling
});
