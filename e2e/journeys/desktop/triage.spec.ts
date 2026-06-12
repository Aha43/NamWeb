import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

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
    await expect(page.getByText('Renew passport')).toHaveCount(0); // left the backlog

    // In-app nav (no reload) so the optimistic promotion is observed deterministically.
    await page.getByRole('navigation', { name: 'Sidebar' }).getByRole('link', { name: 'Next' }).click();
    await expect(page.getByText('Renew passport')).toBeVisible();
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
      .build(),
  });

  test('lists blocked actions under their blocker, which opens for editing', async ({ page }) => {
    await page.goto('/blocked');
    await expect(page.getByText('Blocked by: Write release notes')).toBeVisible();
    await expect(page.getByText('Ship the release')).toBeVisible();

    await page.getByRole('button', { name: 'Open blocker Write release notes' }).click();
    await expect(page.getByRole('dialog').getByText('Edit action')).toBeVisible();
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
    await page.getByRole('dialog').getByRole('button', { name: 'Make project' }).click();

    // Navigate in-app (no full reload) so the optimistic change is observed deterministically.
    await page.getByRole('navigation', { name: 'Sidebar' }).getByRole('link', { name: 'Projects' }).click();
    await expect(page.getByRole('button', { name: 'Open Plan trip' })).toBeVisible();
  });

  test('reparent a free action into a project (Move to…)', async ({ page }) => {
    await page.goto('/next');
    await page.getByRole('button', { name: 'Edit Fix sink' }).click();
    await page.getByLabel('Move to').selectOption({ label: 'Home' });

    await page.getByRole('navigation', { name: 'Sidebar' }).getByRole('link', { name: 'Projects' }).click();
    await page.getByRole('button', { name: 'Open Home' }).click();
    await expect(page.getByText('Fix sink')).toBeVisible();
  });

  test('demote a leaf project back to an action (Convert to action)', async ({ page }) => {
    await page.goto('/projects');
    await page.getByRole('button', { name: 'Open Errand' }).click();
    await page.getByRole('button', { name: 'Convert to action' }).click();

    // Redirected back to the list; it is no longer a project.
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole('button', { name: 'Open Errand' })).toHaveCount(0);
  });
});
