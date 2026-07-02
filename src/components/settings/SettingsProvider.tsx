import { useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_DATE_FORMAT, type DateFormat } from '@/lib/dates';
import { activateLocale, LOCALES, type Locale } from '@/lib/i18n';
import {
  ADD_TO_BOTTOM_STORAGE_KEY,
  BOOKMARK_STYLE_STORAGE_KEY,
  DATE_FORMAT_STORAGE_KEY,
  DEFAULT_BOOKMARK_STYLE,
  LANGUAGE_STORAGE_KEY,
  SettingsContext,
  type BookmarkStyle,
} from './settings-context';

const DATE_FORMATS: DateFormat[] = ['medium', 'iso', 'dmy', 'mdy'];

/** Stored language, else detect from the browser (`nb`/`no*`/`nn` → nb, else en). */
function initialLanguage(): Locale {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && stored in LOCALES) return stored as Locale;
  } catch {
    // localStorage unavailable — fall through to detection.
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'en';
  return nav.startsWith('nb') || nav.startsWith('no') || nav.startsWith('nn') ? 'nb' : 'en';
}

function initialDateFormat(): DateFormat {
  try {
    const stored = localStorage.getItem(DATE_FORMAT_STORAGE_KEY);
    if (stored && (DATE_FORMATS as string[]).includes(stored)) return stored as DateFormat;
  } catch {
    // localStorage unavailable — fall back to the default.
  }
  return DEFAULT_DATE_FORMAT;
}

function initialAddToBottom(): boolean {
  try {
    return localStorage.getItem(ADD_TO_BOTTOM_STORAGE_KEY) === '1';
  } catch {
    return false; // default: add to top
  }
}

function initialBookmarkStyle(): BookmarkStyle {
  try {
    const stored = localStorage.getItem(BOOKMARK_STYLE_STORAGE_KEY);
    if (stored === 'icons' || stored === 'labels') return stored;
  } catch {
    // localStorage unavailable — fall back to the default.
  }
  return DEFAULT_BOOKMARK_STYLE;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [dateFormat, setDateFormat] = useState<DateFormat>(initialDateFormat);
  const [language, setLanguage] = useState<Locale>(initialLanguage);
  const [bookmarkStyle, setBookmarkStyle] = useState<BookmarkStyle>(initialBookmarkStyle);
  // The persisted default; the effective value starts there and the inline toggle flips it (session).
  const [addToBottomDefault, setDefaultState] = useState<boolean>(initialAddToBottom);
  const [addToBottom, setAddToBottom] = useState<boolean>(addToBottomDefault);

  useEffect(() => {
    try {
      localStorage.setItem(DATE_FORMAT_STORAGE_KEY, dateFormat);
    } catch {
      // best-effort persistence
    }
  }, [dateFormat]);

  // Drive the i18n runtime + <html lang> from the language setting, and persist it.
  useEffect(() => {
    void activateLocale(language);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // best-effort persistence
    }
  }, [language]);

  useEffect(() => {
    try {
      localStorage.setItem(BOOKMARK_STYLE_STORAGE_KEY, bookmarkStyle);
    } catch {
      // best-effort persistence
    }
  }, [bookmarkStyle]);

  // Only the default persists; the effective `addToBottom` is here-and-now (resets on reload).
  useEffect(() => {
    try {
      localStorage.setItem(ADD_TO_BOTTOM_STORAGE_KEY, addToBottomDefault ? '1' : '0');
    } catch {
      // best-effort persistence
    }
  }, [addToBottomDefault]);

  // Changing the default in Settings applies immediately (and becomes the new here-and-now value).
  const setAddToBottomDefault = (value: boolean) => {
    setDefaultState(value);
    setAddToBottom(value);
  };

  return (
    <SettingsContext.Provider
      value={{
        dateFormat,
        setDateFormat,
        language,
        setLanguage,
        bookmarkStyle,
        setBookmarkStyle,
        addToBottom,
        setAddToBottom,
        addToBottomDefault,
        setAddToBottomDefault,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}
