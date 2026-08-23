import { useSettings } from '@/components/settings/settings-context';

/**
 * Whether action rows should render compact — driven solely by the per-list compact toggle (#765).
 * The single row-height control since #1185 retired the overlapping page-band "density" preset.
 * (Shared so the row and its controls shrink together — tuning row `py` alone did nothing while the
 * `p-2` control buttons kept the row ~30px tall.)
 */
export function useCompactRows(): boolean {
  const { compactRows } = useSettings();
  return compactRows;
}
