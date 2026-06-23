import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { AuthUserContext } from '@/auth/auth-context';

/** A stand-in authenticated user for tests that mount routes/shell needing `useAuthUser`. */
const testUser = { id: 'test-user', email: 'test@example.com' } as unknown as User;

/** Wraps a tree in the auth-user context the authed app normally provides at the gate. */
export function WithAuthUser({ children }: { children: ReactNode }) {
  return <AuthUserContext.Provider value={testUser}>{children}</AuthUserContext.Provider>;
}
