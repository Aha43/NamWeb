// Extraction sweep tooling for I18N (#400). Scans `t('key')` usages and keeps the catalogs in sync;
// `--fail-on-update` (via `npm run i18n:check`) is the CI safety net so a new un-catalogued key can't
// merge. Keys are dotted, literal ids (keySeparator/namespaceSeparator off); English values are
// hand-authored in en/translation.json (not derived from the key), so new keys land empty and must
// be filled. Unused keys are kept (removal is a deliberate manual step, not automatic).
export default {
  locales: ['en', 'nb'],
  input: ['src/**/*.{ts,tsx}', '!src/**/*.{test,spec}.{ts,tsx}'],
  output: 'src/locales/$LOCALE/translation.json',
  keySeparator: false,
  namespaceSeparator: false,
  defaultNamespace: 'translation',
  sort: true,
  keepRemoved: true,
  createOldCatalogs: false,
  defaultValue: '',
};
