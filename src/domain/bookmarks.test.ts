import { describe, expect, it } from 'vitest';
import { applyIntent } from './mutations';
import { createDefaultWorkspace } from './createWorkspace';
import type { Bookmark, WorkspaceDocument } from './types';

const bm = (over: Partial<Bookmark> = {}): Bookmark => ({
  id: 'b1',
  label: 'Vacation',
  kind: 'project',
  projectId: 'p1',
  color: '#3b82f6',
  ...over,
});

describe('bookmark intents', () => {
  it('addBookmark appends to the document', () => {
    const doc = applyIntent(createDefaultWorkspace(), { type: 'addBookmark', bookmark: bm() });
    expect(doc.bookmarks).toEqual([bm()]);
  });

  it('addBookmark is idempotent on the same id (replay-safe)', () => {
    let doc = applyIntent(createDefaultWorkspace(), { type: 'addBookmark', bookmark: bm() });
    doc = applyIntent(doc, { type: 'addBookmark', bookmark: bm({ label: 'changed' }) });
    expect(doc.bookmarks).toHaveLength(1);
  });

  it('removeBookmark drops the matching id', () => {
    let doc = applyIntent(createDefaultWorkspace(), { type: 'addBookmark', bookmark: bm() });
    doc = applyIntent(doc, { type: 'addBookmark', bookmark: bm({ id: 'b2', label: '#home', kind: 'tagFilter', tags: ['home'], projectId: undefined }) });
    doc = applyIntent(doc, { type: 'removeBookmark', id: 'b1' });
    expect(doc.bookmarks?.map((b) => b.id)).toEqual(['b2']);
  });

  it('handles a document with no bookmarks field (older/desktop docs)', () => {
    // Simulate a pulled doc that predates the field.
    const legacy = { ...createDefaultWorkspace() } as WorkspaceDocument;
    delete legacy.bookmarks;
    const doc = applyIntent(legacy, { type: 'addBookmark', bookmark: bm() });
    expect(doc.bookmarks).toEqual([bm()]);
    const cleared = applyIntent(legacy, { type: 'removeBookmark', id: 'whatever' });
    expect(cleared.bookmarks).toEqual([]);
  });
});
