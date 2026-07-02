import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ICU from 'i18next-icu';
import en from '@/locales/en/translation.json';
import nb from '@/locales/nb/translation.json';

// I18N runtime (epic #400, design: docs/features/i18n/design.md). react-i18next is runtime-only (no
// build-time macro), so it behaves identically in the Vite build and Vitest — the deciding factor
// over Lingui, whose babel macros don't transform under Vitest. ICU MessageFormat (via i18next-icu)
// gives plurals/interpolation that Java's ICU4J mirrors on the NamDesktop side. Keys are dotted,
// ID-style (English is a plain fallback, not the key), with a `domain.*` subset kept as the
// shareable vocabulary.

export const LOCALES = { en: 'English', nb: 'Norsk' } as const;
export type Locale = keyof typeof LOCALES;

/** Where the language preference persists (defined here, not in settings, so init can read it). */
export const LANGUAGE_STORAGE_KEY = 'namweb.settings.language';

/** Stored language, else detect from the browser (`nb`/`no*`/`nn` → nb, else en). Synchronous, so
 *  the runtime can init in the right language and the *first* paint is already translated —
 *  previously nb users got an English flash while a post-mount effect switched languages (#579). */
export function detectInitialLocale(): Locale {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && stored in LOCALES) return stored as Locale;
  } catch {
    // localStorage unavailable — fall through to detection.
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'en';
  return nav.startsWith('nb') || nav.startsWith('no') || nav.startsWith('nn') ? 'nb' : 'en';
}

const initialLocale = detectInitialLocale();

void i18n
  .use(ICU)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, nb: { translation: nb } },
    lng: initialLocale,
    fallbackLng: 'en',
    // Dotted ids are literal keys — not paths. English lives in the `en` catalog, not the key.
    keySeparator: false,
    nsSeparator: false,
    interpolation: { escapeValue: false },
    // Inline resources → init resolves synchronously; no Suspense so components render translated on
    // first paint (and in tests).
    react: { useSuspense: false },
  });

// Reflect the initial language on <html lang> immediately (screen readers announce in it).
if (typeof document !== 'undefined') document.documentElement.lang = initialLocale;

/** Switch the active locale and reflect it on `<html lang>`. */
export async function activateLocale(locale: Locale): Promise<void> {
  await i18n.changeLanguage(locale);
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
}

export default i18n;
