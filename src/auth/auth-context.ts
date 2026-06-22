import { createContext, useContext } from 'react';
import type { User } from '@supabase/supabase-js';

/** The authenticated user, provided once by the auth gate (App → AuthedApp). Available synchronously
 *  throughout the authed tree, so features never re-run `getSession()` or read an `anon` fallback. */
export const AuthUserContext = createContext<User | undefined>(undefined);

export function useAuthUser(): User {
  const user = useContext(AuthUserContext);
  if (!user) throw new Error('useAuthUser must be used within the authed app');
  return user;
}
