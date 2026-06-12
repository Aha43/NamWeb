// Shared E2E configuration, resolved from the environment with local-stack defaults.
//
// Defaults target the local Supabase stack (NamDesktop `make supabase-start`) and the
// dev test user the Login form prefills — overridable via env so the same suite can run
// against another stack. The smoke runs against an isolated `e2e` workspace row, never
// `default`, so a developer's real cloud data is untouched.

export const E2E = {
  /** The dedicated port Playwright boots Vite on — distinct from the hand-run dev server (5173). */
  baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5174',
  supabaseUrl: process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321',
  supabaseKey:
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
  email: process.env.E2E_EMAIL ?? 'test@namdesktop.local',
  password: process.env.E2E_PASSWORD ?? 'namdesktop-local',
  /** Isolated workspace row for E2E; injected into the dev server and reset before each run. */
  workspaceName: process.env.VITE_WORKSPACE_NAME ?? 'e2e',
} as const;

/** Where the real signed-in session snapshot is stored for reuse across the smoke spec. */
export const STORAGE_STATE = 'e2e/.auth/user.json';

/** Where the mocked-auth session snapshot is stored for reuse across the network-mocked journeys. */
export const MOCK_STORAGE_STATE = 'e2e/.auth/mocked-user.json';
