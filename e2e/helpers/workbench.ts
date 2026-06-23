import { type Page, type Locator } from '@playwright/test';

/**
 * Expand the workbench sections that collapse by default (#279) so a journey can interact with the
 * action rows and sub-project rows. Only clicks a header that is actually collapsed
 * (`aria-expanded="false"`), and skips headers that aren't present. (The add-action / add-sub-project
 * rows live inside the sections and are always visible, so they don't need expanding.)
 * Scope to a `page` or a sub-locator (e.g. a dialog) as needed.
 */
export async function expandWorkbench(scope: Page | Locator): Promise<void> {
  // Wait for the workbench chrome to render before probing collapse state — `count()` below is a
  // snapshot (no auto-wait), so without this it can run before the page paints and expand nothing.
  // Every project workbench has a "Summary" button, so it's a reliable anchor.
  await scope.getByRole('button', { name: 'Summary', exact: true }).first().waitFor();
  for (const name of ['Actions', 'Sub-projects']) {
    const header = scope.getByRole('button', { name, exact: true });
    if ((await header.count()) > 0 && (await header.first().getAttribute('aria-expanded')) === 'false') {
      await header.first().click();
    }
  }
}
