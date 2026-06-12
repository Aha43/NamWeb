import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// J7 — the cross-surface states that are awkward against a real backend but easy to force with
// the network mock: a failed initial load, a sync conflict, and the empty surfaces.

test.describe('initial-load failure', () => {
  test.use({ restOptions: { failFirstGet: true } });

  test('shows the error with Retry, then recovers', async ({ page }) => {
    await page.goto('/inbox');
    await expect(page.getByText('Simulated load failure')).toBeVisible();

    await page.getByRole('button', { name: 'Retry' }).click();

    // The retry re-pulls successfully → the surface renders.
    await expect(page.getByText('Simulated load failure')).toHaveCount(0);
    await expect(page.getByLabel('Quick add')).toBeVisible();
  });
});

test.describe('sync conflict', () => {
  test.use({
    seedDoc: new DocBuilder().action('a1', 'Email Bob').build(),
    restOptions: { alwaysConflict: true },
  });

  test('a failed push surfaces the dismissible Reloaded notice', async ({ page }) => {
    await page.goto('/next');
    await expect(page.getByText('Email Bob')).toBeVisible();

    // Any write now conflicts on every attempt → the commit gives up and reloads.
    await page.getByRole('button', { name: /Status of Email Bob/ }).click();
    await page.getByRole('menuitem', { name: 'Done' }).click();

    const notice = page.getByRole('status');
    await expect(notice).toContainText('Reloaded');
    await notice.getByRole('button', { name: 'Dismiss' }).click();
    await expect(page.getByRole('status')).toHaveCount(0);
  });
});

test.describe('empty surfaces', () => {
  test('backlog, due, and blocked show their empty copy', async ({ page }) => {
    await page.goto('/backlog');
    await expect(page.getByText('Backlog is empty.')).toBeVisible();

    await page.goto('/due');
    await expect(page.getByText('Nothing due.')).toBeVisible();

    await page.goto('/blocked');
    await expect(page.getByText('Nothing blocked.')).toBeVisible();
  });
});
