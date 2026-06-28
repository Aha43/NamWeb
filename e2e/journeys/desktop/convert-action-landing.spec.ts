import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #479 — converting an (empty) sub-project to an action should land on the PARENT workbench, where
// the new action now lives — not the top-level Projects list.
test.use({
  seedDoc: new DocBuilder().project('parent', 'Parent').project('child', 'Child', { under: 'parent' }).build(),
});

test('converting a sub-project to an action lands on the parent workbench', async ({ page, doc }) => {
  await page.goto('/projects/child');

  await page.getByRole('button', { name: 'Convert to action' }).click();

  // Land on the parent project's workbench (not the top-level /projects list).
  await expect(page).toHaveURL(/\/projects\/parent$/);
  // The converted node is now a NEXT action still under the parent.
  await expect.poll(() => doc.current().nodes['child'].project).toBe(false);
  await expect.poll(() => doc.current().nodes['child'].status).toBe('NEXT');
  await expect.poll(() => doc.current().nodes['parent'].childIds).toContain('child');
});
