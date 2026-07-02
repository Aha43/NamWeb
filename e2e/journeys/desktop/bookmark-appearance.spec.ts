import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #560 — the "Bookmark appearance" preference toggles whether toolbar bookmarks show a label
// (icons+labels) or just a colored icon named by tooltip (icons). Network-mocked.
const seed = new DocBuilder().project('vac', 'Vacation').build();
seed.bookmarks = [{ id: 'bm', label: 'Vacation', kind: 'project' as const, projectId: 'vac', color: '#3b82f6' }];

test.use({ seedDoc: seed });

test('the Bookmark appearance setting toggles toolbar labels and persists', async ({ page }) => {
  await page.goto('/account?tab=preferences');

  // Default is "icons": the toolbar bookmark is an icon named by tooltip — no visible label text.
  const bookmark = page.getByRole('button', { name: 'Go to bookmark: Vacation' });
  await expect(bookmark).toBeVisible();
  await expect(bookmark).not.toContainText('Vacation');

  // Switch to "Icons with labels" → the label appears live.
  await page.getByLabel('Bookmark appearance').selectOption('labels');
  await expect(bookmark).toContainText('Vacation');

  // Persists across a reload.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Go to bookmark: Vacation' })).toContainText('Vacation');
});
