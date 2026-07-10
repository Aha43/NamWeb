import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

/** Local YYYY-MM-DD, offset days from today (matches the app's local-date semantics). */
function localDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// #706 — derived project time. A holiday project with dated contents: toggling "Derive from
// contents" gives it an effective span (ghost placeholders in Details, hint on rows, folder
// badges across the calendar span) without writing any dates.
test.use({
  seedDoc: new DocBuilder()
    .project('hol', 'Holiday')
    .action('out', 'Fly out', { under: 'hol', dueAt: localDate(2) })
    .action('home', 'Fly home', { under: 'hol', dueAt: localDate(6) })
    .build(),
});

test('derive from contents: ghosts in Details, span on the calendar (#706)', async ({ page }) => {
  await page.goto('/projects/hol');
  await page.getByRole('button', { name: 'Details' }).click();
  // The due controls are dense until expanded (#721); the derive toggle lives inside.
  await page.getByRole('button', { name: /Add due date|Edit due date/i }).click();
  await page.getByRole('checkbox', { name: 'Derive from contents' }).check();

  // The derived span appears as ghost placeholders — nothing typed, nothing persisted.
  await expect(page.getByRole('textbox', { name: 'Due', exact: true })).toHaveAttribute('placeholder', localDate(2));
  await expect(page.getByLabel('Due end (optional)')).toHaveAttribute('placeholder', localDate(6));

  // The Projects list row carries the derived hint (italic = derived).
  await page.goto('/projects');
  await expect(page.locator('li', { hasText: 'Holiday' }).locator('.italic').first()).toBeVisible();

  // The calendar marks a mid-span day with the project badge (0 actions due there).
  await page.goto('/calendar');
  await expect(page.getByRole('grid')).toBeVisible();
  const midSpan = page.locator(`[aria-label="${localDate(4)}: 0 due, 1 project"]`);
  if ((await midSpan.count()) === 0) {
    await page.getByRole('button', { name: 'Next month' }).click(); // near month-end the span lives there
  }
  await expect(midSpan).toBeVisible();

  // Drill in: the Projects section lists Holiday with its derived span.
  await midSpan.click();
  await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open Holiday' })).toBeVisible();
});

test('the holiday case: an explicit start wins, the end keeps deriving (#706)', async ({ page, doc }) => {
  await page.goto('/projects/hol');
  await page.getByRole('button', { name: 'Details' }).click();
  // The due controls are dense until expanded (#721); the derive toggle lives inside.
  await page.getByRole('button', { name: /Add due date|Edit due date/i }).click();
  await page.getByRole('checkbox', { name: 'Derive from contents' }).check();

  // Leave the house before the first flight: type an explicit start.
  const due = page.getByRole('textbox', { name: 'Due', exact: true });
  await due.fill(localDate(0));
  await due.blur();

  // Persisted: explicit start only — the derived end is never written.
  await expect.poll(() => {
    const n = doc.current().nodes['hol'] as { dueAt: string | null; dueEndAt: string | null; deriveDue?: boolean };
    return `${n.dueAt} ${n.dueEndAt} ${n.deriveDue}`;
  }).toBe(`${localDate(0)} null true`);

  // The end ghost still shows the derived edge.
  await expect(page.getByLabel('Due end (optional)')).toHaveAttribute('placeholder', localDate(6));
});
