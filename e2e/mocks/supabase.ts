// Network-mocked Supabase for the fast, deterministic E2E journeys (#61).
//
// Unlike the real-backend smoke (smoke.spec.ts → local Supabase), the journeys intercept the
// Supabase HTTP calls with Playwright `route` so they need no backend: fast, hermetic, and able
// to force states (conflict/error) that are awkward against a real stack.
//
// Two surfaces are mocked, mirroring the contract in src/sync/workspaceClient.ts and the
// GoTrue auth flow the Login form drives:
//   • REST  /rest/v1/workspaces — pull (GET), version-guarded push (PATCH), first-push (POST)
//   • Auth  /auth/v1/*          — password/refresh token + user, so a session can exist offline
//
// The workspace is a single JSONB blob guarded by an optimistic `version` counter; the mock
// holds it in memory, serves pulls from it, and applies guarded pushes to it.

import type { Page, Route } from '@playwright/test';
import type { WorkspaceDocument } from '../../src/domain/types';

/** Stable fake identity for the mocked session (the REST mock ignores the owner filter). */
export const MOCK_USER = {
  id: 'e2e00000-0000-4000-8000-000000000000',
  email: 'e2e@namweb.local',
} as const;

// CORS: localhost:5174 (app) → 127.0.0.1:54321 (Supabase) is cross-origin, so the browser
// preflights. Every fulfilled response (and the OPTIONS preflight) carries permissive CORS.
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': '*',
};

const JSON_HEADERS = { ...CORS_HEADERS, 'Content-Type': 'application/json' };

/** A far-future session so GoTrue never tries to refresh (which would need the network). */
function mockSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365 * 50; // +50y
  return {
    access_token: 'mock-access-token',
    token_type: 'bearer',
    expires_in: 60 * 60 * 24 * 365 * 50,
    expires_at: expiresAt,
    refresh_token: 'mock-refresh-token',
    user: mockUser(),
  };
}

function mockUser() {
  return {
    id: MOCK_USER.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: MOCK_USER.email,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    identities: [],
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  };
}

/** True when the client asked for a single object (`.single()` / `.maybeSingle()`). */
function wantsObject(route: Route): boolean {
  const accept = route.request().headers()['accept'] ?? '';
  return accept.includes('application/vnd.pgrst.object+json');
}

/** Parse a PostgREST `?version=eq.3` style filter into its number, or null if absent. */
function eqNumber(url: URL, param: string): number | null {
  const raw = url.searchParams.get(param);
  if (!raw) return null;
  const n = Number(raw.replace(/^eq\./, ''));
  return Number.isNaN(n) ? null : n;
}

/**
 * Install the auth mock so a session can be obtained (and persisted) without a backend.
 * Covers password + refresh-token grants, the user endpoint, and logout.
 */
export async function installAuthMock(page: Page): Promise<void> {
  await page.route('**/auth/v1/**', async (route) => {
    const method = route.request().method();
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS, body: '' });
      return;
    }
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/token')) {
      await route.fulfill({ status: 200, headers: JSON_HEADERS, body: JSON.stringify(mockSession()) });
      return;
    }
    if (url.pathname.endsWith('/user')) {
      await route.fulfill({ status: 200, headers: JSON_HEADERS, body: JSON.stringify(mockUser()) });
      return;
    }
    if (url.pathname.endsWith('/logout')) {
      await route.fulfill({ status: 204, headers: CORS_HEADERS, body: '' });
      return;
    }
    // Anything else GoTrue might probe (settings, etc.) — answer benignly.
    await route.fulfill({ status: 200, headers: JSON_HEADERS, body: '{}' });
  });
}

/**
 * Install the REST mock over `/rest/v1/workspaces`, backed by an in-memory row seeded from
 * `initialDoc`. Returns a handle so a test can inspect the doc after pushes if it wants to.
 */
export async function installRestMock(
  page: Page,
  initialDoc: WorkspaceDocument,
): Promise<{ current(): WorkspaceDocument; version(): number }> {
  // The single mocked row. The app pulls it, then pushes guarded on its version.
  const row = { version: 1, document: structuredClone(initialDoc) as WorkspaceDocument };

  await page.route('**/rest/v1/workspaces**', async (route) => {
    const method = route.request().method();
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS, body: '' });
      return;
    }

    const url = new URL(route.request().url());

    // pull / existing-check: SELECT the row.
    if (method === 'GET') {
      const payload = { version: row.version, document: row.document };
      const body = wantsObject(route) ? JSON.stringify(payload) : JSON.stringify([payload]);
      await route.fulfill({ status: 200, headers: JSON_HEADERS, body });
      return;
    }

    // push: version-guarded UPDATE (set version = guard + 1 WHERE version == guard).
    if (method === 'PATCH') {
      const guard = eqNumber(url, 'version');
      const update = route.request().postDataJSON() as { document: WorkspaceDocument; version: number };
      if (guard !== null && guard === row.version) {
        row.version = update.version;
        row.document = update.document;
        await route.fulfill({ status: 200, headers: JSON_HEADERS, body: JSON.stringify([{ version: row.version }]) });
      } else {
        // Guard missed → client falls through to its first-push/conflict disambiguation (GET).
        await route.fulfill({ status: 200, headers: JSON_HEADERS, body: JSON.stringify([]) });
      }
      return;
    }

    // first push (no row yet) — not normally hit since journeys seed a row, but kept faithful.
    if (method === 'POST') {
      const insert = route.request().postDataJSON() as { document: WorkspaceDocument };
      row.version = 1;
      row.document = insert.document;
      const payload = { version: row.version };
      const body = wantsObject(route) ? JSON.stringify(payload) : JSON.stringify([payload]);
      await route.fulfill({ status: 201, headers: JSON_HEADERS, body });
      return;
    }

    await route.fulfill({ status: 200, headers: JSON_HEADERS, body: '[]' });
  });

  return {
    current: () => row.document,
    version: () => row.version,
  };
}
