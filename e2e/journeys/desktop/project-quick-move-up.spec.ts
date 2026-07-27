import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #962 — a sub-project's quick-move menu offers "level up" (into the grandparent project), like an
// action does, not just "Top level" + Browse. Here Plumbing (under Bathroom under Home Reno) can hop
// up one level to Home Reno.
test.use({
  seedDoc: new DocBuilder()
    .project('home', 'Home Reno')
    .project('bath', 'Bathroom', { under: 'home' })
    .project('plumb', 'Plumbing', { under: 'bath' })
    .build(),
});

test('sub-project quick-move offers level-up to the grandparent', async ({ page, doc }) => {
  await page.goto('/projects/bath'); // the Bathroom workbench — Plumbing is a sub-project row here
  await page.getByRole('button', { name: 'Sub-projects' }).click(); // section is collapsed by default
  await page.getByRole('button', { name: 'Move Plumbing into another project' }).click();

  // "Level up" to Home Reno (the grandparent) is offered — the gap this closes.
  const upToHome = page.getByRole('menuitem', { name: 'Home Reno' });
  await expect(upToHome).toBeVisible();
  await upToHome.click();

  // Plumbing is now a child of Home Reno (a sibling of Bathroom), out of Bathroom.
  await expect.poll(() => doc.current().nodes['home'].childIds).toContain('plumb');
  await expect.poll(() => doc.current().nodes['bath'].childIds).not.toContain('plumb');
});
