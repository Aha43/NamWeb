import { createContext, useContext } from 'react';
import { DEFAULT_DATE_FORMAT, type DateFormat } from '@/lib/dates';

export interface SettingsContextValue {
  dateFormat: DateFormat;
  setDateFormat: (format: DateFormat) => void;
}

export const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

/**
 * App settings (device-level preferences). Unlike `useTheme`, this falls back to defaults when no
 * provider is mounted, so presentational rows that only read a display preference (e.g. the due
 * date format) work in isolation — including in tests — without wrapping them in a provider.
 */
export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext) ?? { dateFormat: DEFAULT_DATE_FORMAT, setDateFormat: () => {} };
}

export const DATE_FORMAT_STORAGE_KEY = 'namweb.settings.date-format';
