import { createContext, useContext } from 'react';
import { DEFAULT_DATE_FORMAT, type DateFormat } from '@/lib/dates';
import type { Locale } from '@/lib/i18n';

/** How wide the central content area may grow (#958). `full` = today's edge-to-edge fill. */
export type ContentWidth = 'comfortable' | 'wide' | 'full';
/** Page-level vertical rhythm (#958). `comfortable` = today's spacing; tighter = more list per screen. */
export type Density = 'comfortable' | 'cozy' | 'compact';
/** The status a newly-added project action gets (#1132). Default `NEXT` — capturing usually means intent. */
export type NewActionDefault = 'NEXT' | 'BACKLOG';

export interface SettingsContextValue {
  dateFormat: DateFormat;
  setDateFormat: (format: DateFormat) => void;
  /** UI language (device-level) — drives the i18n runtime. */
  language: Locale;
  setLanguage: (language: Locale) => void;
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
  /** The status a new project action gets when added (#1132, device-level). Default `NEXT`. */
  defaultNewActionStatus: NewActionDefault;
  setDefaultNewActionStatus: (status: NewActionDefault) => void;
  /** Labs (device-level): surfaces features still being built dark. Off = those controls simply
   *  don't render. Tenantless since #856 (project sharing left Labs at 2.0.0); kept as the
   *  ship-dark mechanism for the next in-progress feature. */
  labs: boolean;
  setLabs: (labs: boolean) => void;
  /** Compact rows (device-level, #765): action lists drop the tag/time meta line and tighten
   *  padding — for when you're really relating to a long list. Default off (the richer look). */
  compactRows: boolean;
  setCompactRows: (compact: boolean) => void;
  /** Content width (device-level, #958): cap the central area so lists aren't a screen wide.
   *  Default `comfortable`. */
  contentWidth: ContentWidth;
  setContentWidth: (width: ContentWidth) => void;
  /** Vertical density (device-level, #958): tighten the page-level spacing so you see more list.
   *  Default `comfortable` (today's rhythm). */
  density: Density;
  setDensity: (density: Density) => void;
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
      dense: false,
      setDense: () => {},
      addToBottom: false,
      setAddToBottom: () => {},
      addToBottomDefault: false,
      setAddToBottomDefault: () => {},
      defaultNewActionStatus: 'NEXT',
      setDefaultNewActionStatus: () => {},
      labs: false,
      setLabs: () => {},
      compactRows: false,
      setCompactRows: () => {},
      contentWidth: 'comfortable',
      setContentWidth: () => {},
      density: 'comfortable',
      setDensity: () => {},
    }
  );
}

export const DATE_FORMAT_STORAGE_KEY = 'namweb.settings.date-format';
export const ADD_TO_BOTTOM_STORAGE_KEY = 'namweb.settings.add-to-bottom';
export const DEFAULT_ACTION_STATUS_STORAGE_KEY = 'namweb.settings.default-action-status';
// The language key lives in @/lib/i18n (init reads it before any provider mounts, #579);
// re-exported here so settings code keeps one import site for storage keys.
export { LANGUAGE_STORAGE_KEY } from '@/lib/i18n';
// 'namweb.settings.bookmark-style' existed for the toolbar strip (#560 → removed by #593);
// stale localStorage entries are harmless orphans.
export const DENSE_STORAGE_KEY = 'namweb.settings.dense';
export const LABS_STORAGE_KEY = 'namweb.settings.labs';
export const COMPACT_ROWS_STORAGE_KEY = 'namweb.settings.compact-rows';
export const CONTENT_WIDTH_STORAGE_KEY = 'namweb.settings.content-width';
export const DENSITY_STORAGE_KEY = 'namweb.settings.density';
// 'namweb.settings.capture-recent-limit' existed briefly (#617 → removed by #622, never in a
// release); stale localStorage entries are harmless orphans.
