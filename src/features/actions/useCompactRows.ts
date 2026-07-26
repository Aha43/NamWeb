import { useSettings } from '@/components/settings/settings-context';

/**
 * Whether action rows should render compact — the per-list compact toggle OR Compact density (#958).
 * Shared so the row and its controls (which set the row height) shrink together; tuning the row `py`
 * alone did nothing because the `p-2` control buttons kept the row ~30px tall.
 */
export function useCompactRows(): boolean {
  const { compactRows, density } = useSettings();
  return compactRows || density === 'compact';
}
