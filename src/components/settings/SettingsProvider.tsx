import { useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_DATE_FORMAT, type DateFormat } from '@/lib/dates';
import { ADD_TO_BOTTOM_STORAGE_KEY, DATE_FORMAT_STORAGE_KEY, SettingsContext } from './settings-context';

const DATE_FORMATS: DateFormat[] = ['medium', 'iso', 'dmy', 'mdy'];

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

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [dateFormat, setDateFormat] = useState<DateFormat>(initialDateFormat);
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
      value={{ dateFormat, setDateFormat, addToBottom, setAddToBottom, addToBottomDefault, setAddToBottomDefault }}
    >
      {children}
    </SettingsContext.Provider>
  );
}
