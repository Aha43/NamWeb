import type { User } from '@supabase/supabase-js';

/**
 * A synthetic user for the no-account demo, so `useAuthUser()` consumers (e.g. the per-user
 * Get-Started dismissal) work without a real Supabase session. The demo never talks to the backend,
 * so only `id` / `email` matter; the rest is filler to satisfy the `User` shape.
 */
export const DEMO_USER = {
  id: 'demo-user',
  email: 'demo@usenam.app',
  app_metadata: {},
  user_metadata: {},
  aud: 'demo',
  created_at: '1970-01-01T00:00:00.000Z',
} as unknown as User;
