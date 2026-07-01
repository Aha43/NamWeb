// I18N safety net (#400). ICU-agnostic — unlike i18next-parser, it doesn't try to expand `count`
// into i18next `_one`/`_other` plural keys (we use ICU MessageFormat, one key per message). It just
// checks that every literal `t('key')` used in the app has an `en` catalog entry, and that `nb` is
// in key-parity with `en`. Dynamic keys (`t(variable)`) are skipped. Run: `npm run i18n:check`.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const read = (p) => JSON.parse(readFileSync(p, 'utf8'));
const enKeys = new Set(Object.keys(read('src/locales/en/translation.json')));
const nbKeys = new Set(Object.keys(read('src/locales/nb/translation.json')));

/** All non-test .ts/.tsx under src/. */
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\./.test(name)) out.push(p);
  }
  return out;
}

// Matches `t('key'...)` and `i18n.t('key'...)`, not `format(`/`it(`/etc. (no word char before `t`).
const RE = /(?<![\w])t\(\s*['"`]([^'"`]+)['"`]/g;
const used = new Set();
for (const file of walk('src')) {
  const src = readFileSync(file, 'utf8');
  // Skip interpolated/dynamic keys — e.g. t(`domain.status.${s}`) — they're resolved at runtime.
  for (const m of src.matchAll(RE)) if (!m[1].includes('${')) used.add(m[1]);
}

const missingInEn = [...used].filter((k) => !enKeys.has(k)).sort();
const nbMissing = [...enKeys].filter((k) => !nbKeys.has(k)).sort();
const nbExtra = [...nbKeys].filter((k) => !enKeys.has(k)).sort();

let ok = true;
const fail = (label, keys) => {
  if (keys.length) {
    ok = false;
    console.error(`\n${label}:\n  ${keys.join('\n  ')}`);
  }
};
fail('Keys used in code but missing from en catalog', missingInEn);
fail('Keys in en but missing from nb', nbMissing);
fail('Keys in nb but not in en', nbExtra);

if (ok) {
  console.log(`i18n check OK — ${enKeys.size} keys, en/nb in parity, all used keys present.`);
}
process.exit(ok ? 0 : 1);
