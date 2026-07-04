import { createContext, useContext } from 'react';
import { DEFAULT_DATE_FORMAT, type DateFormat } from '@/lib/dates';
import type { Locale } from '@/lib/i18n';

/** How bookmarks render where hover works (toolbar + project picker): compact icon (name in a
 *  tooltip) or icon + visible label. The phone More sheet always shows labels (no hover on touch). */
export type BookmarkStyle = 'icons' | 'labels';
export const DEFAULT_BOOKMARK_STYLE: BookmarkStyle = 'icons';

export interface SettingsContextValue {
  dateFormat: DateFormat;
  setDateFormat: (format: DateFormat) => void;
  /** UI language (device-level) — drives the i18n runtime. */
  language: Locale;
  setLanguage: (language: Locale) => void;
  /** Bookmark appearance (device-level): compact icons+tooltip vs icons+labels. */
  bookmarkStyle: BookmarkStyle;
  setBookmarkStyle: (style: BookmarkStyle) => void;
  /** Dense mode (device-level): hide the labels next to command-bar and sidebar icons (#598). */
  dense: boolean;
  setDense: (dense: boolean) => void;
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
      bookmarkStyle: DEFAULT_BOOKMARK_STYLE,
      setBookmarkStyle: () => {},
      dense: false,
      setDense: () => {},
      addToBottom: false,
      setAddToBottom: () => {},
      addToBottomDefault: false,
      setAddToBottomDefault: () => {},
    }
  );
}

export const DATE_FORMAT_STORAGE_KEY = 'namweb.settings.date-format';
export const ADD_TO_BOTTOM_STORAGE_KEY = 'namweb.settings.add-to-bottom';
// The language key lives in @/lib/i18n (init reads it before any provider mounts, #579);
// re-exported here so settings code keeps one import site for storage keys.
export { LANGUAGE_STORAGE_KEY } from '@/lib/i18n';
export const BOOKMARK_STYLE_STORAGE_KEY = 'namweb.settings.bookmark-style';
export const DENSE_STORAGE_KEY = 'namweb.settings.dense';
// 'namweb.settings.capture-recent-limit' existed briefly (#617 → removed by #622, never in a
// release); stale localStorage entries are harmless orphans.
