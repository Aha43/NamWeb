import { type Page, type Locator } from '@playwright/test';

/**
 * Expand the workbench sections that collapse by default (#279) so a journey can interact with the
 * add-panel inputs, action rows, and sub-project rows. Only clicks a header that is actually
 * collapsed (`aria-expanded="false"`), and skips headers that aren't present (e.g. no sub-projects).
 * Scope to a `page` or a sub-locator (e.g. a dialog) as needed.
 */
export async function expandWorkbench(scope: Page | Locator): Promise<void> {
  // Wait for the workbench chrome to render before probing collapse state — `count()` below is a
  // snapshot (no auto-wait), so without this it can run before the page paints and expand nothing.
  // Every project workbench has the "Add to project" panel, so it's a reliable anchor.
  await scope.getByRole('button', { name: 'Add to project', exact: true }).first().waitFor();
  for (const name of ['Add to project', 'Actions', 'Sub-projects']) {
    const header = scope.getByRole('button', { name, exact: true });
    if ((await header.count()) > 0 && (await header.first().getAttribute('aria-expanded')) === 'false') {
      await header.first().click();
    }
  }
}
