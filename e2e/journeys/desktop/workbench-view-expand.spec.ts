import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #418 — the view switch (List / Heat-map / Column) only changes how sub-projects render, all inside
// the Sub-projects section, which collapses by default (#279). Picking a view while it's folded looked
// like "nothing happened"; selecting a view should expand the section so the choice is visible.
// Network-mocked.
test.use({
  seedDoc: new DocBuilder()
    .project('proj', 'Project')
    .action('a1', 'Alpha', { under: 'proj' })
    .project('sp1', 'Phase 1', { under: 'proj' })
    .action('s1', 'Sub-A', { under: 'sp1' })
    .build(),
});

test('selecting a view expands the collapsed Sub-projects section', async ({ page }) => {
  await page.goto('/projects/proj');

  // Sub-projects starts collapsed, so its rows are hidden.
  const subsHeader = page.getByRole('button', { name: 'Sub-projects', exact: true });
  await expect(subsHeader).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('button', { name: 'Open Phase 1' })).toHaveCount(0);

  // Picking a view reveals the section so the chosen view is actually shown.
  await page.getByRole('button', { name: 'Heat-map', exact: true }).click();
  await expect(subsHeader).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: 'Open Phase 1' })).toBeVisible();
});
