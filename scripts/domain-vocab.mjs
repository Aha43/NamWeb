// Shared `domain.*` vocabulary (I18N Phase C, epic #400). The surface names + statuses that NamWeb
// and NamDesktop agree on. `translation.json` is the source of truth; this derives the shared subset
// so it can be exported (shared/i18n/domain.{locale}.json) and consumed by NamDesktop via ICU4J.
import { readFileSync } from 'node:fs';

export const LOCALES = ['en', 'nb'];
export const PREFIX = 'domain.';

/** The `domain.*` slice of a locale's catalog, key-sorted. */
export function domainVocabFor(locale) {
  const catalog = JSON.parse(readFileSync(`src/locales/${locale}/translation.json`, 'utf8'));
  const out = {};
  for (const key of Object.keys(catalog).filter((k) => k.startsWith(PREFIX)).sort()) {
    out[key] = catalog[key];
  }
  return out;
}

/** Serialize a locale's shared vocabulary exactly as it is written to disk (stable formatting). */
export function serializeDomainVocab(locale) {
  return JSON.stringify(domainVocabFor(locale), null, 2) + '\n';
}

export const artifactPath = (locale) => `shared/i18n/domain.${locale}.json`;
