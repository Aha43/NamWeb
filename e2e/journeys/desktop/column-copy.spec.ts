import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #501 — Column view: the action card's copy icon has a tooltip, and the sub-project column header
// gets a copy of the project name (with tooltip).
test.use({
  seedDoc: new DocBuilder()
    .project('proj', 'Project')
    .action('a1', 'Alpha', { under: 'proj', tags: ['ctx'] }) // a meta line keeps the title clear of the hover footer
    .project('sp1', 'Phase 1', { under: 'proj' })
    .build(),
});

test('copy icons carry tooltips in Column view, incl. the project name', async ({ page }) => {
  await page.goto('/projects/proj');
  await page.getByRole('button', { name: 'Column' }).click();

  // The sub-project column header now offers a copy of its name (new affordance).
  const projectCopy = page.getByRole('button', { name: 'Copy name "Phase 1"' });
  await expect(projectCopy).toBeVisible();
  await projectCopy.hover();
  await expect(page.getByRole('tooltip')).toContainText('Copy name "Phase 1"');

  // The action card's copy icon has a tooltip too. The controls are inert (pointer-events-none) at
  // rest, so reveal them by hovering the card's top-left (clear of the bottom-right overlay), then
  // hover the now-active copy icon.
  await page.getByText('Alpha').locator('xpath=ancestor::li[1]').hover({ position: { x: 8, y: 6 } });
  await page.getByRole('button', { name: 'Copy name "Alpha"' }).hover();
  await expect(page.getByRole('tooltip')).toContainText('Copy name "Alpha"');
});
