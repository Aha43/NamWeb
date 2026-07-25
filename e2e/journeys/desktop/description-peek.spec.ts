import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #940 — when a row's description is longer than the hover preview shows, a chevron beside the title
// opens the full text in a popover, without opening the editor.
const LONG = 'This is a long description that runs well past the preview cutoff. '.repeat(4) + 'FINALWORD';

test.use({
  seedDoc: new DocBuilder()
    .action('a', 'Task with notes', { status: 'NEXT', description: LONG })
    .action('b', 'Short one', { status: 'NEXT', description: 'brief' }) // no chevron — fits the preview
    .build(),
});

test('a truncated description gets a chevron that opens the full text in a popover', async ({ page }) => {
  await page.goto('/next');
  await expect(page.getByRole('button', { name: 'Edit Task with notes' })).toBeVisible();

  // The peek chevron appears only on the row whose description is cut.
  const peeks = page.getByRole('button', { name: 'Show more' });
  await expect(peeks).toHaveCount(1);

  // Clicking it opens the full description (the final word, hidden in the preview) — and does NOT open
  // the editor (title-click's job).
  await peeks.click();
  const full = page.getByRole('dialog', { name: 'Show more' });
  await expect(full).toBeVisible();
  await expect(full).toContainText('FINALWORD');
});
