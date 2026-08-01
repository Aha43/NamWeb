import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

/** Local YYYY-MM-DD, offset days from today. */
function localDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// #995 — the agenda (list) calendar view: a continuous list of dated projects + actions, Overdue at
// the top, then today onward; no empty days, no add box. A Grid ⇄ List toggle switches views, and
// Show done applies. Network-mocked.
test.use({
  seedDoc: new DocBuilder()
    .action('slip', 'Slipped task', { dueAt: localDate(-3) }) // past + open → Overdue (red)
    .action('now', 'Do today', { dueAt: localDate(0) })
    .action('soon', 'Later thing', { dueAt: localDate(12) })
    .action('none', 'Someday maybe', {}) // undated → never in the agenda
    .action('fin', 'Finished', { dueAt: localDate(-5), status: 'DONE' }) // past + done → Earlier, not Overdue
    .project('proj', 'Launch v2', { dueAt: localDate(12) })
    .build(),
});

test('switch to the agenda list: Overdue + today onward, no empty days, Show done, back to grid', async ({ page }) => {
  await page.goto('/calendar');

  // Grid ⇄ List toggle → the agenda.
  await page.getByRole('button', { name: 'List' }).click();
  await expect(page).toHaveURL(/[?&]view=list/);

  // Overdue group surfaces the past-due item; today onward shows its items; the dated project too.
  await expect(page.getByText('Overdue')).toBeVisible();
  await expect(page.getByText('Slipped task')).toBeVisible();
  await expect(page.getByText(/Today ·/)).toBeVisible();
  await expect(page.getByText('Do today')).toBeVisible();
  await expect(page.getByText('Later thing')).toBeVisible();
  await expect(page.getByText('Launch v2')).toBeVisible();

  // Overdue holds the open past item; there's no "Earlier" (past-completed) group yet (Done is off).
  await expect(page.getByText('Overdue')).toBeVisible();
  await expect(page.getByText('Earlier')).toHaveCount(0);

  // Undated items never appear; DONE is hidden by default (the Done box is off).
  await expect(page.getByText('Someday maybe')).toHaveCount(0);
  await expect(page.getByText('Finished')).toHaveCount(0);

  // Check Done → the past completed item shows under a neutral "Earlier" group (not red Overdue).
  await page.getByRole('checkbox', { name: 'Done' }).check();
  await expect(page.getByText('Earlier')).toBeVisible();
  await expect(page.getByText('Finished')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Done' }).uncheck();
  await expect(page.getByText('Finished')).toHaveCount(0);
  await expect(page.getByText('Earlier')).toHaveCount(0);

  // Back to the classic grid.
  await page.getByRole('button', { name: 'Grid' }).click();
  await expect(page).not.toHaveURL(/[?&]view=list/);
  await expect(page.getByLabel('Month calendar')).toBeVisible();
});
