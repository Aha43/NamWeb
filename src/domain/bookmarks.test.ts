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

  it('renameBookmark sets the label; trims; empty and unknown ids are safe no-ops (#732)', () => {
    let doc = applyIntent(createDefaultWorkspace(), { type: 'addBookmark', bookmark: bm() });
    doc = applyIntent(doc, { type: 'renameBookmark', id: 'b1', label: '  Vacation (Japan)  ' });
    expect(doc.bookmarks?.[0].label).toBe('Vacation (Japan)');
    // Everything else on the bookmark survives a rename.
    expect(doc.bookmarks?.[0]).toEqual(bm({ label: 'Vacation (Japan)' }));
    // Empty (after trim) never lands — the dialog guards, this covers replay/imports.
    doc = applyIntent(doc, { type: 'renameBookmark', id: 'b1', label: '   ' });
    expect(doc.bookmarks?.[0].label).toBe('Vacation (Japan)');
    // Unknown id (removed on another device since): tolerated no-op.
    doc = applyIntent(doc, { type: 'renameBookmark', id: 'ghost', label: 'x' });
    expect(doc.bookmarks).toHaveLength(1);
  });

  it('renameBookmark on a document with no bookmarks field is a safe no-op', () => {
    const doc = createDefaultWorkspace();
    delete (doc as Partial<WorkspaceDocument>).bookmarks;
    const next = applyIntent(doc, { type: 'renameBookmark', id: 'b1', label: 'x' });
    expect(next.bookmarks ?? []).toEqual([]);
  });

  it('reorderBookmarks stores the permutation; unknown ids skipped, unmentioned appended (#636)', () => {
    let doc = applyIntent(createDefaultWorkspace(), { type: 'addBookmark', bookmark: bm() });
    doc = applyIntent(doc, { type: 'addBookmark', bookmark: bm({ id: 'b2', label: 'Two' }) });
    doc = applyIntent(doc, { type: 'addBookmark', bookmark: bm({ id: 'b3', label: 'Three' }) });

    doc = applyIntent(doc, { type: 'reorderBookmarks', order: ['b3', 'b1', 'b2'] });
    expect(doc.bookmarks?.map((b) => b.id)).toEqual(['b3', 'b1', 'b2']);

    // Replay-tolerant: an id that vanished is skipped; a bookmark the order doesn't mention
    // (added on another device since) keeps existing, appended after the ordered ones.
    doc = applyIntent(doc, { type: 'reorderBookmarks', order: ['b2', 'ghost', 'b3'] });
    expect(doc.bookmarks?.map((b) => b.id)).toEqual(['b2', 'b3', 'b1']);
  });

  it('reorderBookmarks ignores duplicate ids in the order — no bookmark is duplicated (#645)', () => {
    let doc = applyIntent(createDefaultWorkspace(), { type: 'addBookmark', bookmark: bm() });
    doc = applyIntent(doc, { type: 'addBookmark', bookmark: bm({ id: 'b2', label: 'Two' }) });
    doc = applyIntent(doc, { type: 'reorderBookmarks', order: ['b2', 'b2', 'b1', 'b2'] });
    expect(doc.bookmarks?.map((b) => b.id)).toEqual(['b2', 'b1']);
  });

  it('reorderBookmarks on a document with no bookmarks field is a safe no-op', () => {
    const legacy = { ...createDefaultWorkspace() } as WorkspaceDocument;
    delete legacy.bookmarks;
    const doc = applyIntent(legacy, { type: 'reorderBookmarks', order: ['b1'] });
    expect(doc.bookmarks).toEqual([]);
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
