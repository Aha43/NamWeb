import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #85 (Workspace parity, phase 4) — collapse a workbench column to a strip; the collapsed set is
// persisted per-project, so it survives a reload. Network-mocked.
test.use({
  seedDoc: new DocBuilder()
    .project('proj', 'Project')
    .action('a1', 'Alpha', { under: 'proj' })
    .project('sp1', 'Phase 1', { under: 'proj' })
    .action('s1', 'Sub-A', { under: 'sp1' })
    .build(),
});

test('collapse a column; it stays collapsed across reload', async ({ page }) => {
  await page.goto('/projects/proj');
  await page.getByRole('button', { name: 'Column' }).click();
  await expect(page.getByText('Sub-A')).toBeVisible();

  await page.getByRole('button', { name: 'Collapse Phase 1' }).click();
  await expect(page.getByText('Sub-A')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Expand Phase 1' })).toBeVisible();

  // Both the Column view mode and the collapsed set are persisted.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Expand Phase 1' })).toBeVisible();
  await expect(page.getByText('Sub-A')).toHaveCount(0);
});
