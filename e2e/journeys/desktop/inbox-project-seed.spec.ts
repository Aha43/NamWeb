import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';
import { expandWorkbench } from '../../helpers/workbench';

// #1007 — making a project from an inbox item seeds its first actions in the moment, and the
// two-button footer decides whether to open the new project or keep processing the inbox.
// Network-mocked.

test.describe('open the new project', () => {
  test.use({ seedDoc: new DocBuilder().inbox('i1', 'Plan the trip').build() });

  test('inbox → project: rename, seed actions, Create & open', async ({ page, doc }) => {
    await page.goto('/inbox');
    await page.getByRole('button', { name: 'Process Plan the trip' }).click();
    await page.getByRole('button', { name: /make a project/i }).click();
    await page.getByRole('button', { name: 'Make project', exact: true }).click();

    // Rename the project + jot a first action.
    await page.getByRole('button', { name: 'Rename the project' }).click();
    const nameInput = page.getByRole('textbox', { name: 'Rename Plan the trip' });
    await nameInput.fill('Summer holiday');
    await nameInput.press('Enter');
    const addInput = page.getByRole('textbox', { name: 'Add an action' });
    await addInput.fill('Book flights');
    await addInput.press('Enter');

    await page.getByRole('button', { name: 'Create & open project' }).click();

    // Lands on the new project (the item's id), renamed, with the seeded action.
    await expect(page).toHaveURL(/\/projects\/i1$/);
    await expect.poll(() => doc.current().nodes['i1'].project).toBe(true);
    await expect.poll(() => doc.current().nodes['i1'].title).toBe('Summer holiday');
    await expandWorkbench(page);
    await expect(page.getByText('Book flights')).toBeVisible();
  });
});

test.describe('keep processing the inbox', () => {
  test.use({
    seedDoc: new DocBuilder().inbox('i1', 'Plan the trip').inbox('i2', 'Call the bank').build(),
  });

  test('inbox deck → project: Create & keep processing advances without leaving', async ({ page, doc }) => {
    await page.goto('/inbox');
    await page.getByRole('button', { name: /Process inbox/ }).click(); // the deck

    await page.getByRole('button', { name: /make a project/i }).click();
    await page.getByRole('button', { name: 'Make project', exact: true }).click();
    await page.getByRole('button', { name: 'Create & keep processing' }).click();

    // The item became a project; the deck stays open on the remaining item (didn't navigate away).
    await expect.poll(() => doc.current().nodes['i1'].project).toBe(true);
    await expect(page).toHaveURL(/\/inbox$/);
    const deck = page.getByRole('dialog');
    await expect(deck).toBeVisible();
    await expect(deck.getByText(/Call the bank/)).toBeVisible(); // the deck advanced to the next item
  });
});
