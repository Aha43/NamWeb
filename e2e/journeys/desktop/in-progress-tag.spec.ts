import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #651/#837 — the built-in "#in-progress" system tag (# sigil reserves the namespace): one-click toggle on rows, always offered as a
// filter, protected from rename/delete in tag management. Network-mocked.
test.use({
  seedDoc: new DocBuilder()
    .action('a1', 'Write report', { status: 'NEXT' })
    .action('a2', 'Water plants', { status: 'NEXT' })
    .build(),
});

test('toggle in-progress from a row, filter by it, and see it protected in manage', async ({ page, doc }) => {
  await page.goto('/next');

  // One click on the row toggle marks the action; the tag chip shows on the row.
  await page.getByRole('button', { name: 'Working on it: Write report' }).click();
  await expect.poll(() => doc.current().nodes['a1'].tags).toContain('#in-progress');
  await expect(page.getByText('#in-progress', { exact: true }).first()).toBeVisible();

  // The tag filters like any tag — and is offered even though it was never "created".
  await page.goto('/tags');
  await page.getByRole('button', { name: '#in-progress', exact: true }).click();
  await expect(page.getByText('Write report')).toBeVisible();
  await expect(page.getByText('Water plants')).toHaveCount(0); // not tagged → filtered out

  // Tag management: the system tag is listed (bold) but offers no rename/delete.
  await page.getByRole('button', { name: /Manage/ }).click();
  await expect(page.getByRole('button', { name: 'Rename tag #in-progress' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete tag #in-progress' })).toHaveCount(0);

  // Toggling again clears the mark.
  await page.goto('/next');
  const toggle = page.getByRole('button', { name: 'Working on it: Write report' });
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await toggle.click();
  await expect.poll(() => doc.current().nodes['a1'].tags).not.toContain('#in-progress');
});
