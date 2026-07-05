import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #553/#642 — the project picker offers bookmarks in a menu; picking one jumps the columns straight
// to that (deep) project so you can drill further or confirm. Network-mocked.
const seed = new DocBuilder()
  .project('home', 'Home Reno')
  .project('bath', 'Bathroom', { under: 'home' })
  .project('plumb', 'Plumbing', { under: 'bath' })
  .action('tiles', 'Buy tiles') // a free action, shows in Next
  .build();
// Bookmark the deep project (DocBuilder has no bookmark helper — attach it directly).
seed.bookmarks = [{ id: 'bm-plumb', label: 'Plumbing', kind: 'project' as const, projectId: 'plumb', color: '#3b82f6' }];

test.use({ seedDoc: seed });

test('a bookmark chip jumps the picker straight to a deep project', async ({ page, doc }) => {
  await page.goto('/next');

  // Open the move picker for the free action.
  await page.getByRole('button', { name: 'Edit Buy tiles' }).click();
  await page.getByRole('button', { name: 'Move / make project' }).click();
  await page.getByRole('button', { name: 'Move to…' }).click();

  const picker = page.getByRole('dialog', { name: /Move "Buy tiles" to/ });
  await expect(picker).toBeVisible();

  // Bookmarks live behind a menu now (#642): open it, one click jumps to Plumbing (3 levels
  // deep) — no column-by-column drill.
  await picker.getByRole('button', { name: 'Bookmarks' }).click();
  await page.getByRole('menuitem', { name: 'Jump to Plumbing' }).click();

  // The jump selected Plumbing (a valid target), so "Move here" is enabled — confirming lands the move.
  const moveHere = picker.getByRole('button', { name: 'Move here' });
  await expect(moveHere).toBeEnabled();
  // Plumbing is now open/selected in its column, reached without drilling.
  await expect(picker.getByRole('button', { name: 'Plumbing', exact: true })).toHaveAttribute('aria-current', 'true');
  await moveHere.click();

  // The action landed under Plumbing.
  await expect.poll(() => doc.current().nodes['plumb'].childIds).toContain('tiles');
});
