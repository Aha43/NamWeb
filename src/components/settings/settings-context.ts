import { createContext, useContext } from 'react';
import { DEFAULT_DATE_FORMAT, type DateFormat } from '@/lib/dates';
import type { Locale } from '@/lib/i18n';

/** How bookmarks render where hover works (toolbar + project picker): compact icon (name in a
 *  tooltip) or icon + visible label. The phone More sheet always shows labels (no hover on touch). */
export type BookmarkStyle = 'icons' | 'labels';
export const DEFAULT_BOOKMARK_STYLE: BookmarkStyle = 'icons';

/** How many just-captured items stay listed in the capture dialog (#617). */
export const DEFAULT_CAPTURE_RECENT_LIMIT = 4;
export const CAPTURE_RECENT_LIMIT_MIN = 1;
export const CAPTURE_RECENT_LIMIT_MAX = 10;

/** Parse + clamp a stored/typed capture-list size; anything unusable falls back to the default. */
export function clampCaptureRecentLimit(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_CAPTURE_RECENT_LIMIT;
  return Math.min(CAPTURE_RECENT_LIMIT_MAX, Math.max(CAPTURE_RECENT_LIMIT_MIN, n));
}

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
  /** How many just-captured items stay listed in the capture dialog (device-level, #617). */
  captureRecentLimit: number;
  setCaptureRecentLimit: (limit: number) => void;
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
      captureRecentLimit: DEFAULT_CAPTURE_RECENT_LIMIT,
      setCaptureRecentLimit: () => {},
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
export const CAPTURE_RECENT_LIMIT_STORAGE_KEY = 'namweb.settings.capture-recent-limit';
