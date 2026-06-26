import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #423 — the desktop Finder-style (Miller-columns) project picker, adopted in the Action editor.
// Navigate columns into a nested project and move an action there. Network-mocked.
test.use({
  seedDoc: new DocBuilder()
    .project('home', 'Home Reno')
    .project('bath', 'Bathroom', { under: 'home' })
    .project('plumb', 'Plumbing', { under: 'bath' })
    .action('tiles', 'Buy tiles') // a free action (under Free actions), shows in Next
    .build(),
});

test('move an action via the column picker, drilling into a nested project', async ({ page, doc }) => {
  await page.goto('/next');

  // Open the editor for the free action, reveal the Move section, open the picker.
  await page.getByRole('button', { name: 'Edit Buy tiles' }).click();
  await page.getByRole('button', { name: 'Move / make project' }).click();
  await page.getByRole('button', { name: 'Move to…' }).click();

  const picker = page.getByRole('dialog', { name: /Move "Buy tiles" to/ });
  await expect(picker).toBeVisible();

  // Column-by-column: Home Reno → Bathroom → Plumbing (each click opens the next column).
  await picker.getByRole('button', { name: 'Home Reno' }).click();
  await picker.getByRole('button', { name: 'Bathroom' }).click();
  await picker.getByRole('button', { name: 'Plumbing' }).click();
  await picker.getByRole('button', { name: 'Move here' }).click();

  // The action is now a child of Plumbing and no longer under Free actions.
  await expect.poll(() => doc.current().nodes['plumb'].childIds).toContain('tiles');
  await expect.poll(() => doc.current().nodes[doc.current().nextActionsNodeId].childIds).not.toContain('tiles');
});
