import { describe, it, expect } from 'vitest';
import { affectedTutorials, globToRegExp, isPathGlob } from './staleness';
import type { Tutorial } from './catalog';

const sample: Tutorial[] = [
  {
    id: 'process-inbox',
    title: 'How to process items in the inbox',
    viewports: ['desktop'],
    surfaces: ['src/**/Inbox*', 'inbox', 'clarify'],
    slides: [{ shot: 'a', caption: 'a' }],
  },
  {
    id: 'focus-by-tag',
    title: 'Focus by tag',
    viewports: ['desktop'],
    surfaces: ['src/**/Focus*', 'focus'],
    slides: [{ shot: 'b', caption: 'b' }],
  },
];

describe('globToRegExp', () => {
  it('matches a file directly under the **/ segment', () => {
    expect(globToRegExp('src/**/Inbox*').test('src/InboxPage.tsx')).toBe(true);
  });

  it('matches a file nested several segments deep', () => {
    expect(globToRegExp('src/**/Inbox*').test('src/routes/inbox/InboxPage.tsx')).toBe(true);
  });

  it('does not let a single * cross a path separator', () => {
    expect(globToRegExp('src/*.ts').test('src/a/b.ts')).toBe(false);
    expect(globToRegExp('src/*.ts').test('src/a.ts')).toBe(true);
  });

  it('does not match an unrelated path', () => {
    expect(globToRegExp('src/**/Inbox*').test('src/sync/workspaceClient.ts')).toBe(false);
  });
});

describe('isPathGlob', () => {
  it('treats path-like and wildcard entries as globs, plain words as keywords', () => {
    expect(isPathGlob('src/**/Inbox*')).toBe(true);
    expect(isPathGlob('a/b')).toBe(true);
    expect(isPathGlob('inbox')).toBe(false);
  });
});

describe('affectedTutorials', () => {
  it('flags a tutorial when a changed path matches its glob', () => {
    const stale = affectedTutorials(
      { changedPaths: ['src/routes/InboxPage.tsx'], changelogText: '' },
      sample,
    );
    expect(stale.map((s) => s.tutorial.id)).toEqual(['process-inbox']);
    expect(stale[0].matched).toContain('src/**/Inbox*');
  });

  it('flags a tutorial when the changelog text mentions a keyword', () => {
    const stale = affectedTutorials(
      { changedPaths: [], changelogText: 'Reworked the Inbox clarify deck copy. Closes #1.' },
      sample,
    );
    expect(stale.map((s) => s.tutorial.id)).toEqual(['process-inbox']);
    // both the 'inbox' and 'clarify' keywords matched
    expect(stale[0].matched).toEqual(expect.arrayContaining(['inbox', 'clarify']));
  });

  it('returns nothing for a change that touches no tutorial surface', () => {
    const stale = affectedTutorials(
      { changedPaths: ['src/sync/workspaceClient.ts'], changelogText: 'Fixed a sync retry race.' },
      sample,
    );
    expect(stale).toEqual([]);
  });

  it('can flag more than one tutorial at once', () => {
    const stale = affectedTutorials(
      { changedPaths: ['src/routes/InboxPage.tsx', 'src/routes/FocusPage.tsx'], changelogText: '' },
      sample,
    );
    expect(stale.map((s) => s.tutorial.id).sort()).toEqual(['focus-by-tag', 'process-inbox']);
  });

  it('defaults to the real catalog and keyword-matches "inbox"', () => {
    const stale = affectedTutorials({ changedPaths: [], changelogText: 'A change to the inbox.' });
    expect(stale.some((s) => s.tutorial.id === 'process-inbox')).toBe(true);
  });
});
