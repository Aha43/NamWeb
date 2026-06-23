import { useCallback, useEffect, useState } from 'react';

const PREFIX = 'namweb.getstarted.dismissed';

function keyFor(scope: string | undefined): string {
  // Scope the dismissal to the signed-in account so dismissing it for one user doesn't suppress
  // onboarding for another user on the same browser. Falls back to a shared bucket pre-session.
  return `${PREFIX}:${scope ?? 'anon'}`;
}

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

/** Whether the get-started card has been dismissed (persisted, per `scope` — the signed-in user id).
 *  Pair with an empty-workspace check so it only ever shows to someone who hasn't started yet. */
export function useGetStartedDismissed(scope?: string): [boolean, () => void] {
  const key = keyFor(scope);
  const [dismissed, setDismissed] = useState<boolean>(() => read(key));

  // Re-read when the account (and thus the key) becomes known or changes.
  useEffect(() => {
    setDismissed(read(key));
  }, [key]);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(key, 'true');
    } catch {
      // best-effort
    }
    setDismissed(true);
  }, [key]);

  return [dismissed, dismiss];
}
