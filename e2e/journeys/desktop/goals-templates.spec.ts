import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// J5 — Mission Control + templates: tag-grouped Goal Boards (heat-map → drill) and the
// save-as-template / apply-template round-trip. Network-mocked.

test.describe('goal boards', () => {
  test.use({
    seedDoc: new DocBuilder()
      .project('p1', 'Kitchen', { tags: ['house'] })
      .action('p1a1', 'Tiles', { status: 'DONE', under: 'p1' })
      .action('p1a2', 'Paint', { status: 'NEXT', under: 'p1' })
      .build(),
  });

  test('create a board, see its station heat-map, drill in', async ({ page }) => {
    await page.goto('/goals');
    await page.getByLabel('Board name').fill('Renovation');
    await page.getByLabel('Board tags').fill('house');
    await page.getByRole('button', { name: 'Create' }).click();

    // The board is listed and its matching project shows as a station.
    await expect(page.getByRole('button', { name: 'Open board Renovation' })).toBeVisible();
    await page.getByRole('button', { name: 'Open Kitchen' }).click();

    // Drilled into the project workbench.
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' }).getByText('Kitchen')).toBeVisible();
  });

  test('delete a board', async ({ page }) => {
    await page.goto('/goals');
    await page.getByLabel('Board name').fill('Renovation');
    await page.getByLabel('Board tags').fill('house');
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('button', { name: 'Open board Renovation' })).toBeVisible();

    await page.getByRole('button', { name: 'Delete board Renovation' }).click();
    await expect(page.getByRole('button', { name: 'Open board Renovation' })).toHaveCount(0);
  });
});

test.describe('templates', () => {
  test.use({
    seedDoc: new DocBuilder()
      .project('p-src', 'Onboarding')
      .action('p-src-a', 'Sign forms', { under: 'p-src' })
      .project('p-src-sub', 'Setup', { under: 'p-src' })
      .project('p-dst', 'New hire: Sam')
      .build(),
  });

  test('save a project as a template, then apply it to another project', async ({ page }) => {
    // Save the Onboarding subtree as a template (the workbench uses window.prompt for the name).
    await page.goto('/projects');
    await page.getByRole('button', { name: 'Open Onboarding' }).click();
    page.once('dialog', (dialog) => dialog.accept('Onboarding template'));
    await page.getByRole('button', { name: 'Save as template…' }).click();

    // It appears on the Templates surface with its item count.
    await page.goto('/templates');
    await expect(page.getByText('Onboarding template')).toBeVisible();
    await expect(page.getByText('2 items')).toBeVisible();

    // Apply it under a different project → its structure is cloned in.
    await page.goto('/projects');
    await page.getByRole('button', { name: 'Open New hire: Sam' }).click();
    await page.getByLabel('Add from template').selectOption({ label: 'Onboarding template' });
    await expect(page.getByText('Sign forms')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open Setup' })).toBeVisible();
  });
});
