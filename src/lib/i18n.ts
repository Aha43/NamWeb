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

void i18n
  .use(ICU)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, nb: { translation: nb } },
    lng: 'en',
    fallbackLng: 'en',
    // Dotted ids are literal keys — not paths. English lives in the `en` catalog, not the key.
    keySeparator: false,
    nsSeparator: false,
    interpolation: { escapeValue: false },
    // Inline resources → init resolves synchronously; no Suspense so components render translated on
    // first paint (and in tests).
    react: { useSuspense: false },
  });

/** Switch the active locale and reflect it on `<html lang>`. */
export async function activateLocale(locale: Locale): Promise<void> {
  await i18n.changeLanguage(locale);
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
}

export default i18n;
