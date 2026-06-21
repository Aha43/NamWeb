import { test, expect } from '../../mockedTest';
import { expandWorkbench } from '../../helpers/workbench';

// #215 — seed the "Learn NAM" onboarding project from the Projects view, then verify it drops you
// into a populated workbench (the three belts) so a new user can learn by doing. Network-mocked.
test('add the Learn NAM project and land in its populated workbench', async ({ page }) => {
  await page.goto('/projects');

  // Empty state shows the CTA link-button; with existing projects it's the ghost button — match either.
  await page.getByRole('button', { name: /Learn NAM/ }).click();

  // Navigates into the new project's workbench.
  await expect(page).toHaveURL(/\/projects\/.+/);
  const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
  await expect(breadcrumb.getByText(/Learn NAM/)).toBeVisible();
  await expandWorkbench(page); // sections collapse by default (#279)

  // The three belt sub-projects are seeded.
  await expect(page.getByText('White belt — basics')).toBeVisible();
  await expect(page.getByText('Yellow belt — organize')).toBeVisible();
  await expect(page.getByText('Green belt — power')).toBeVisible();
});
