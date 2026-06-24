import { createContext, useContext } from 'react';
import { DEFAULT_DATE_FORMAT, type DateFormat } from '@/lib/dates';

export interface SettingsContextValue {
  dateFormat: DateFormat;
  setDateFormat: (format: DateFormat) => void;
  /** When true, new actions/projects/inbox items are appended (bottom) instead of prepended (top). */
  addToBottom: boolean;
  setAddToBottom: (value: boolean) => void;
}

export const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

/**
 * App settings (device-level preferences). Unlike `useTheme`, this falls back to defaults when no
 * provider is mounted, so presentational rows that only read a display preference (e.g. the due
 * date format) work in isolation — including in tests — without wrapping them in a provider.
 */
export function useSettings(): SettingsContextValue {
  return (
    useContext(SettingsContext) ?? {
      dateFormat: DEFAULT_DATE_FORMAT,
      setDateFormat: () => {},
      addToBottom: false,
      setAddToBottom: () => {},
    }
  );
}

export const DATE_FORMAT_STORAGE_KEY = 'namweb.settings.date-format';
export const ADD_TO_BOTTOM_STORAGE_KEY = 'namweb.settings.add-to-bottom';
