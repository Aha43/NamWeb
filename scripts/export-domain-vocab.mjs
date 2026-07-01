// Export (or verify) the shared `domain.*` vocabulary artifacts (I18N Phase C, epic #400).
//   node scripts/export-domain-vocab.mjs           → write shared/i18n/domain.{en,nb}.json
//   node scripts/export-domain-vocab.mjs --check    → exit 1 if the artifacts are stale (CI guard)
import { readFileSync, writeFileSync } from 'node:fs';
import { LOCALES, artifactPath, serializeDomainVocab } from './domain-vocab.mjs';

const check = process.argv.includes('--check');
let stale = false;

for (const locale of LOCALES) {
  const path = artifactPath(locale);
  const next = serializeDomainVocab(locale);
  if (check) {
    let current = '';
    try {
      current = readFileSync(path, 'utf8');
    } catch {
      // missing → treated as stale below
    }
    if (current !== next) {
      stale = true;
      console.error(`✗ ${path} is out of date — run \`npm run i18n:export-domain\`.`);
    }
  } else {
    writeFileSync(path, next);
    console.log(`wrote ${path} (${Object.keys(JSON.parse(next)).length} keys)`);
  }
}

if (check && !stale) console.log('domain vocab artifacts are in sync.');
process.exit(stale ? 1 : 0);
