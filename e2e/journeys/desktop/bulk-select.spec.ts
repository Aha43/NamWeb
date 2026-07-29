import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #921 — multi-select + bulk ops on the flat list views (here: Next). Enter select mode, pick rows,
// then tag / set-status / delete the whole selection from the shared bulk bar.
test.use({
  seedDoc: new DocBuilder()
    .action('a1', 'Task one', { status: 'NEXT', tags: ['home'] }) // an existing tag → a suggestion
    .action('a2', 'Task two', { status: 'NEXT' })
    .action('a3', 'Task three', { status: 'NEXT' })
    .build(),
});

test('Next view: select rows, then bulk-tag and bulk-set-status from the bar', async ({ page, doc }) => {
  await page.goto('/next');
  await expect(page.getByText('Task one')).toBeVisible();

  // Enter select mode → row checkboxes + the bulk bar appear.
  await page.getByRole('button', { name: 'Select' }).click();
  await page.getByRole('checkbox', { name: 'Select Task one' }).check();
  await page.getByRole('checkbox', { name: 'Select Task two' }).check();
  await expect(page.getByText('2 selected')).toBeVisible();

  // Bulk tag the selection (the tag popover commits on Enter).
  await page.getByRole('button', { name: 'Add a tag to the selected items' }).click();
  const tagInput = page.getByPlaceholder('Add a tag…');
  // Suggestions from the workspace show (typing a prefix surfaces the existing 'home' tag) — the
  // popover has its own list, so the browser's autofill never gets a look-in (#921 fix).
  await tagInput.fill('ho');
  await expect(page.getByRole('option', { name: 'home' })).toBeVisible();
  await tagInput.fill('sprint');
  await tagInput.press('Enter');
  await expect.poll(() => doc.current().nodes['a1'].tags).toContain('sprint');
  await expect.poll(() => doc.current().nodes['a2'].tags).toContain('sprint');
  await expect.poll(() => doc.current().nodes['a3'].tags ?? []).not.toContain('sprint'); // unselected untouched

  // #936: the selection PERSISTS after tagging (rows stay put) — no reselect needed. Set status on the
  // still-selected pair directly.
  await expect(page.getByText('2 selected')).toBeVisible();
  await page.getByRole('button', { name: 'Status ▾' }).click();
  await page.getByRole('menuitem', { name: 'Backlog' }).click();
  await expect.poll(() => doc.current().nodes['a1'].status).toBe('BACKLOG');
  await expect.poll(() => doc.current().nodes['a2'].status).toBe('BACKLOG'); // both, still selected after tag
});

// #970 — the bulk Move picker can create a project on the spot (like the editor/workbench pickers),
// then move the selection into it.
test('Next view: bulk-move can create a project and move the selection into it', async ({ page, doc }) => {
  await page.goto('/next');
  await page.getByRole('button', { name: 'Select' }).click();
  await page.getByRole('checkbox', { name: 'Select Task one' }).check();

  await page.getByRole('button', { name: 'Move to…' }).click();
  const picker = page.getByRole('dialog', { name: /Move to/ });
  await expect(picker).toBeVisible();

  // Create a new top-level project from the picker and move into it.
  await picker.getByRole('button', { name: /New project/ }).click();
  await page.getByLabel('New project name').fill('Trip');
  await page.getByLabel('New project name').press('Enter');

  await expect
    .poll(() => {
      const d = doc.current();
      const trip = Object.values(d.nodes).find((n) => n.title === 'Trip' && n.project);
      return trip?.childIds ?? [];
    })
    .toContain('a1');
});
