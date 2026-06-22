import { useCallback, useState } from 'react';

const KEY = 'namweb.getstarted.dismissed';

/** Whether the get-started card has been dismissed (persisted). Pair with an empty-workspace check so
 *  it only ever shows to someone who hasn't started yet. */
export function useGetStartedDismissed(): [boolean, () => void] {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(KEY) === 'true';
    } catch {
      return false;
    }
  });
  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(KEY, 'true');
    } catch {
      // best-effort
    }
    setDismissed(true);
  }, []);
  return [dismissed, dismiss];
}
