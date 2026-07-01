import { createContext, useContext } from 'react';
import { DEFAULT_DATE_FORMAT, type DateFormat } from '@/lib/dates';
import type { Locale } from '@/lib/i18n';

export interface SettingsContextValue {
  dateFormat: DateFormat;
  setDateFormat: (format: DateFormat) => void;
  /** UI language (device-level) — drives the i18n runtime. */
  language: Locale;
  setLanguage: (language: Locale) => void;
  /** Effective (here-and-now) new-item position: true = bottom, false = top. Session-scoped — it
   *  starts from the default and the inline add-box toggle flips it; not persisted. */
  addToBottom: boolean;
  setAddToBottom: (value: boolean) => void;
  /** The persisted default new-item position (set in Settings). New sessions start here. */
  addToBottomDefault: boolean;
  setAddToBottomDefault: (value: boolean) => void;
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
      language: 'en',
      setLanguage: () => {},
      addToBottom: false,
      setAddToBottom: () => {},
      addToBottomDefault: false,
      setAddToBottomDefault: () => {},
    }
  );
}

export const DATE_FORMAT_STORAGE_KEY = 'namweb.settings.date-format';
export const ADD_TO_BOTTOM_STORAGE_KEY = 'namweb.settings.add-to-bottom';
export const LANGUAGE_STORAGE_KEY = 'namweb.settings.language';
