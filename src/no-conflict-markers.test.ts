import { describe, expect, it } from 'vitest';

// #671 — committed merge-conflict markers once escaped to main inside CHANGELOG.md and were
// headed for a GitHub Release body: nothing in the gate reads prose files (code files with
// markers fail typecheck/lint on their own). Scan every markdown file in the repo so the unit
// suite — which runs on every PR — refuses them.
const MARKDOWN = import.meta.glob('../**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

describe('no committed merge-conflict markers', () => {
  it('no markdown file contains conflict markers', () => {
    expect(Object.keys(MARKDOWN)).not.toHaveLength(0); // the glob actually found the prose
    const offenders = Object.entries(MARKDOWN)
      .filter(([, text]) => text.includes('<<<<<<<' + ' ') || text.includes('>>>>>>>' + ' '))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });
});
