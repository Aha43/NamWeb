import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';
import { expandWorkbench } from '../../helpers/workbench';

// J4 — triage breadth: the backlog status switch, the due-date grouping, the blocked surface,
// and reshaping actions ↔ projects. Network-mocked.

/** A local-date string `offset` days from today (matches the app's local-date dueAt semantics). */
function localDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

test.describe('backlog', () => {
  test.use({ seedDoc: new DocBuilder().action('b1', 'Renew passport', { status: 'BACKLOG' }).build() });

  test('the status switch promotes a backlog item to Next', async ({ page }) => {
    await page.goto('/backlog');
    await expect(page.getByText('Renew passport')).toBeVisible();

    await page.getByRole('button', { name: /Status of Renew passport/ }).click();
    await page.getByRole('menuitem', { name: 'Next' }).click();
    // Left the backlog — check the row's Edit button, since the status-change Undo toast (#567)
    // also carries the title text.
    await expect(page.getByRole('button', { name: 'Edit Renew passport' })).toHaveCount(0);

    // In-app nav (no reload) so the optimistic promotion is observed deterministically.
    await page.getByRole('link', { name: 'Next' }).click(); // Next is now a promoted sidebar button (#557)
    await expect(page.getByRole('button', { name: 'Edit Renew passport' })).toBeVisible();
  });
});

test.describe('due', () => {
  test.use({
    seedDoc: new DocBuilder()
      .action('d1', 'Pay rent', { dueAt: localDate(-5) })
      .action('d2', 'Daily standup', { dueAt: localDate(0) })
      .action('d3', 'Dentist', { dueAt: localDate(30) })
      .build(),
  });

  test('groups due actions by urgency', async ({ page }) => {
    await page.goto('/due');
    await expect(page.getByRole('heading', { name: 'Overdue' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Later' })).toBeVisible();
    await expect(page.getByText('Pay rent')).toBeVisible();
    await expect(page.getByText('Daily standup')).toBeVisible();
    await expect(page.getByText('Dentist')).toBeVisible();
  });
});

test.describe('blocked', () => {
  test.use({
    seedDoc: new DocBuilder()
      .action('pre', 'Write release notes')
      .action('blk', 'Ship the release', { blockedBy: ['pre'] })
      .action('oth', 'Order stickers')
      .build(),
  });

  test('lists blocked actions under their blocker, which opens for editing', async ({ page }) => {
    await page.goto('/blocked');
    await expect(page.getByText('Blocked by: Write release notes')).toBeVisible();
    await expect(page.getByText('Ship the release')).toBeVisible();

    await page.getByRole('button', { name: 'Open blocker Write release notes' }).click();
    await expect(page.getByRole('dialog').getByText('Edit action')).toBeVisible();
  });

  test('adds a prerequisite through the action browser (#727)', async ({ page, doc }) => {
    await page.goto('/next');

    await page.getByRole('button', { name: 'Edit Write release notes' }).click();
    const editor = page.getByRole('dialog', { name: 'Edit action' });
    await editor.getByRole('button', { name: 'Blocked by' }).click(); // expand the section
    await editor.getByRole('button', { name: 'Add a prerequisite…' }).click();

    const picker = page.getByRole('dialog', { name: '"Write release notes" is blocked by…' });
    // Let the nested dialog's zoom-in animation finish before clicking rows (stability check).
    await expect
      .poll(() => picker.evaluate((el) => el.getAnimations().every((a) => a.playState === 'finished')))
      .toBe(true);
    await picker.getByRole('button', { name: 'Order stickers' }).click();
    await picker.getByRole('button', { name: 'Add prerequisite' }).click();

    // The intent dispatched immediately (no Save needed) and the section lists the blocker.
    await expect(editor.getByRole('button', { name: 'Remove prerequisite Order stickers' })).toBeVisible();
    await expect.poll(() => doc.current().nodes['pre'].blockedBy).toEqual(['oth']);
  });
});

test.describe('inbox processing', () => {
  test.use({
    seedDoc: new DocBuilder()
      .project('p-kitchen', 'Kitchen Reno')
      .inbox('i1', 'Buy tiles')
      .build(),
  });

  // #320 — clarifying an inbox item as an action lets you file it under an existing project.
  test('files a processed inbox action under a chosen project', async ({ page }) => {
    await page.goto('/inbox');
    await page.getByRole('button', { name: 'Process Buy tiles' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /one action/i }).click();
    // The "File under" control opens the column picker (desktop, #426); choose the existing project.
    await dialog.getByRole('button', { name: 'File under' }).click();
    const filePicker = page.getByRole('dialog', { name: 'File under' });
    await filePicker.getByRole('button', { name: 'Kitchen Reno', exact: true }).click();
    await filePicker.getByRole('button', { name: 'Choose' }).click();
    await dialog.getByRole('button', { name: /do it next/i }).click();

    // The action landed inside the project, not in Free actions.
    await page.getByRole('link', { name: 'Projects' }).click(); // toolbar command bar (#590)
    await page.getByRole('button', { name: 'Open Kitchen Reno' }).click();
    await expandWorkbench(page);
    await expect(page.getByText('Buy tiles')).toBeVisible();
  });
});

test.describe('inbox processing — archived projects', () => {
  test.use({
    seedDoc: new DocBuilder()
      .project('p-live', 'Live Reno')
      .project('p-old', 'Old Reno', { status: 'ARCHIVED' })
      .inbox('i1', 'Buy tiles')
      .build(),
  });

  // #323 — archived projects must not appear as a "File under" target.
  test('omits archived projects from the File under picker', async ({ page }) => {
    await page.goto('/inbox');
    await page.getByRole('button', { name: 'Process Buy tiles' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /one action/i }).click();
    await dialog.getByRole('button', { name: 'File under' }).click();
    const filePicker = page.getByRole('dialog', { name: 'File under' });
    await expect(filePicker.getByRole('button', { name: 'Live Reno', exact: true })).toHaveCount(1);
    await expect(filePicker.getByRole('button', { name: 'Old Reno', exact: true })).toHaveCount(0);
  });
});

test.describe('reshape', () => {
  test.use({
    seedDoc: new DocBuilder()
      .project('p-home', 'Home')
      .project('p-errand', 'Errand')
      .action('a-trip', 'Plan trip')
      .action('a-sink', 'Fix sink')
      .build(),
  });

  test('lift a free action to a project (Make project)', async ({ page }) => {
    await page.goto('/next');
    await page.getByRole('button', { name: 'Edit Plan trip' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Move / make project' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Make project', exact: true }).click();

    // Navigate in-app (no full reload) so the optimistic change is observed deterministically.
    await page.getByRole('link', { name: 'Projects' }).click(); // toolbar command bar (#590)
    await expect(page.getByRole('button', { name: 'Open Plan trip' })).toBeVisible();
  });

  test('reparent a free action into a project (Move to…)', async ({ page }) => {
    await page.goto('/next');
    await page.getByRole('button', { name: 'Edit Fix sink' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Move / make project' }).click();
    // Desktop now uses the Finder-style column picker (#423) instead of a native select.
    await page.getByRole('dialog').getByRole('button', { name: 'Move to…' }).click();
    const picker = page.getByRole('dialog', { name: /Move "Fix sink" to/ });
    await picker.getByRole('button', { name: 'Home' }).click();
    await picker.getByRole('button', { name: 'Move here' }).click();

    await page.getByRole('link', { name: 'Projects' }).click(); // toolbar command bar (#590)
    await page.getByRole('button', { name: 'Open Home' }).click();
    await expandWorkbench(page);
    await expect(page.getByText('Fix sink')).toBeVisible();
  });

  test('demote a leaf project back to an action (Convert to action)', async ({ page }) => {
    await page.goto('/projects');
    await page.getByRole('button', { name: 'Open Errand' }).click();
    await page.getByRole('button', { name: 'Convert to action' }).click();

    // A top-level leaf project becomes a free action, so we land on Next where it now lives (#479) —
    // and it's gone from the Projects list.
    await expect(page).toHaveURL(/\/next$/);
    await expect(page.getByText('Errand')).toBeVisible();
    await page.goto('/projects');
    await expect(page.getByRole('button', { name: 'Open Errand' })).toHaveCount(0);
  });
});
