import { test, expect } from '../../mockedTest';
import { expandWorkbench } from '../../helpers/workbench';

// J2 — the deepest, most stateful surface: create a project, drill into its workbench, add an
// action and a sub-project, drill one level further, then climb back via the breadcrumb. Submits
// quick-adds with Enter to avoid ambiguity between the several "Add" buttons. Network-mocked.
test.describe('projects workbench', () => {
  test('create → drill in → add work → breadcrumb back', async ({ page }) => {
    await page.goto('/projects');

    // Create a top-level project and open its workbench.
    await page.getByLabel('Add project').fill('Roof repair');
    await page.getByLabel('Add project').press('Enter');
    await page.getByRole('button', { name: 'Open Roof repair' }).click();
    await expect(page).toHaveURL(/\/projects\/.+/);
    await expandWorkbench(page); // sections collapse by default (#279); reveals the add-panel inputs

    // Add a direct action. New project actions default to NEXT now (capturing usually means intent),
    // configurable in Settings back to Backlog — #1132 (was BACKLOG-by-default under #210).
    await page.getByLabel('Add action').fill('Buy shingles');
    await page.getByLabel('Add action').press('Enter');
    await expect(page.getByText('Buy shingles')).toBeVisible();
    await expect(page.getByRole('button', { name: /Status of Buy shingles: Next/ })).toBeVisible();

    // Add a sub-project and drill into it.
    await page.getByLabel('Add sub-project').fill('Phase 1');
    await page.getByLabel('Add sub-project').press('Enter');
    await page.getByRole('button', { name: 'Open Phase 1' }).click();

    // The breadcrumb reflects the descent; climbing back restores the parent workbench.
    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(breadcrumb.getByText('Phase 1')).toBeVisible();
    await breadcrumb.getByRole('button', { name: 'Roof repair' }).click();
    await expect(page.getByText('Buy shingles')).toBeVisible();
  });

  // #1132 — the per-user default status for new project actions (NEXT out of the box, Backlog opt-in).
  test('the default-status setting flips new project actions to Backlog', async ({ page }) => {
    await page.goto('/account?tab=preferences');
    await page
      .getByRole('group', { name: 'New project actions default to' })
      .getByRole('button', { name: 'Backlog' })
      .click();

    await page.goto('/projects');
    await page.getByLabel('Add project').fill('Garage');
    await page.getByLabel('Add project').press('Enter');
    await page.getByRole('button', { name: 'Open Garage' }).click();
    await expandWorkbench(page);
    await page.getByLabel('Add action').fill('Sort boxes');
    await page.getByLabel('Add action').press('Enter');
    await expect(page.getByRole('button', { name: /Status of Sort boxes: Backlog/ })).toBeVisible();
  });

  // #343 — delete a project straight from the list, behind an anchored confirm.
  test('delete a project from the list, after confirming', async ({ page }) => {
    await page.goto('/projects');
    await page.getByLabel('Add project').fill('Temp project');
    await page.getByLabel('Add project').press('Enter');
    await expect(page.getByRole('button', { name: 'Open Temp project' })).toBeVisible();

    await page.getByRole('button', { name: 'Delete Temp project' }).click(); // opens the delete dialog
    await page.getByRole('dialog').getByRole('button', { name: 'Delete project' }).click(); // confirm (empty → no options)
    await expect(page.getByRole('button', { name: 'Open Temp project' })).toHaveCount(0);
  });
});
