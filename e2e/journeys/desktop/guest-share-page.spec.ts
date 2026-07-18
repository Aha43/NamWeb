import { test, expect } from '../../mockedTest';
import { DocBuilder } from '../../mocks/docBuilder';

// #761 — the guest page: what a secret share link renders. Network-mocked: the
// get_project_share RPC is intercepted per test (a guest has no session, so the standard
// workspace mocks are bystanders here).

test.use({ seedDoc: new DocBuilder().build() });

const CONTENT = {
  version: 1,
  title: 'Asia round trip',
  note: 'A year in the making.',
  due: { start: '2027-06-01', end: '2027-07-04' },
  publishedAt: '2026-07-13T12:00:00.000Z',
  items: [{ id: 'aa11', title: 'Book flights', due: { start: '2027-06-01' } }],
  sections: [
    { id: 'cc33', title: 'Japan leg', items: [{ id: 'dd44', title: 'Ryokan night' }], sections: [] },
  ],
};

test('a share link renders the itinerary — no sign-in wall, no NAM chrome', async ({ page }) => {
  await page.route('**/rest/v1/rpc/get_project_share', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CONTENT) }),
  );
  await page.goto('/p/tok12345678901234567890');

  await expect(page.getByRole('heading', { name: 'Asia round trip' })).toBeVisible();
  // The TOC (#792): a Contents nav anchoring to the sections.
  const toc = page.getByRole('navigation', { name: 'Contents' });
  await expect(toc.getByRole('link', { name: /Japan leg/ })).toHaveAttribute('href', '#cc33');
  await expect(page.getByText('Book flights')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Japan leg' })).toBeVisible();
  await expect(page.getByText('Shared from')).toBeVisible();

  // Un-NAM: none of the app's furniture, and no sign-in anything.
  await expect(page.getByRole('button', { name: 'Capture' })).toHaveCount(0);
  await expect(page.getByText(/sign in|sign up/i)).toHaveCount(0);

  // Sections open COLLAPSED (#826): the TOC is the front door, details hidden but honest.
  const legHeader = page.getByRole('button', { name: /Japan leg/ });
  await expect(page.getByText('Ryokan night')).toBeHidden();
  await expect(legHeader).toContainText('1 inside');
  // A TOC tap reveals it (fold-aware anchor nav, #794).
  await toc.getByRole('link', { name: /Japan leg/ }).click();
  await expect(page.getByText('Ryokan night')).toBeVisible();
  // And the header folds it back.
  await legHeader.click();
  await expect(page.getByText('Ryokan night')).toBeHidden();

  // The tab is the trip; robots are told to leave.
  await expect(page).toHaveTitle('Asia round trip');
  const robots = await page.locator('meta[name="robots"]').getAttribute('content');
  expect(robots).toContain('noindex');
});

test('a guest sends a suggestion and gets thanked (#796)', async ({ page }) => {
  await page.route('**/rest/v1/rpc/get_project_share', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CONTENT) }),
  );
  let captured: unknown = null;
  await page.route('**/rest/v1/rpc/add_share_suggestion', async (route) => {
    captured = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: 'true' });
  });
  await page.goto('/p/tok12345678901234567890');
  await expect(page.getByRole('heading', { name: 'Asia round trip' })).toBeVisible();

  await page.getByLabel('Your name (optional)').fill('Anna');
  await page.getByLabel('Your suggestion').fill('Ryokan night in Hakone?');
  await page.getByRole('button', { name: 'Send suggestion' }).click();
  await expect(page.getByText('Sent — thank you!')).toBeVisible();
  expect(captured).toMatchObject({ suggestion: 'Ryokan night in Hakone?', guest: 'Anna' });
});

test('an unknown or revoked link is one quiet dead end', async ({ page }) => {
  await page.route('**/rest/v1/rpc/get_project_share', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }),
  );
  await page.goto('/p/nosuchtoken1234567890x');

  await expect(page.getByText('This link is no longer active')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.getByText(/sign in|sign up/i)).toHaveCount(0);
});
