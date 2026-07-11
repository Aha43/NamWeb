import { describe, expect, it } from 'vitest';
import { createDefaultWorkspace } from '@/domain/createWorkspace';
import type { Bookmark, WorkspaceDocument } from '@/domain/types';
import {
  BOOKMARK_COLORS,
  bookmarkFocusTarget,
  bookmarkTarget,
  findBookmark,
  isBookmarkStale,
  nextBookmarkColor,
} from './bookmarks';

describe('bookmark helpers', () => {
  it('cycles palette colors by count', () => {
    expect(nextBookmarkColor([])).toBe(BOOKMARK_COLORS[0]);
    const five = Array.from({ length: BOOKMARK_COLORS.length }, (_, i) => ({ id: `b${i}` }) as Bookmark);
    expect(nextBookmarkColor(five)).toBe(BOOKMARK_COLORS[0]); // wraps around
  });

  it('builds the navigation target for each kind', () => {
    expect(bookmarkTarget({ kind: 'project', projectId: 'p1' } as Bookmark)).toBe('/projects/p1');
    expect(bookmarkTarget({ kind: 'tagFilter', tags: ['home', 'errand'], nextOnly: true } as Bookmark)).toBe(
      '/tags?tags=home%2Cerrand&next=1',
    );
  });

  it('builds the speed-dial focus target for each kind (#738)', () => {
    expect(bookmarkFocusTarget({ kind: 'project', projectId: 'p1' } as Bookmark)).toBe('/focus?project=p1');
    expect(bookmarkFocusTarget({ kind: 'tagFilter', tags: ['home', 'errand'], nextOnly: true } as Bookmark)).toBe(
      '/focus?tags=home%2Cerrand&next=1',
    );
    expect(bookmarkFocusTarget({ kind: 'tagFilter', tags: [] } as unknown as Bookmark)).toBe('/focus');
  });

  it('finds an existing project bookmark by projectId', () => {
    const list: Bookmark[] = [{ id: 'b1', label: 'V', kind: 'project', projectId: 'p1', color: '#fff' }];
    expect(findBookmark(list, { kind: 'project', projectId: 'p1', label: 'V' })?.id).toBe('b1');
    expect(findBookmark(list, { kind: 'project', projectId: 'p2', label: 'X' })).toBeUndefined();
  });

  it('finds a tag-filter bookmark regardless of tag order', () => {
    const list: Bookmark[] = [
      { id: 'b1', label: '#a #b', kind: 'tagFilter', tags: ['a', 'b'], nextOnly: false, color: '#fff' },
    ];
    expect(findBookmark(list, { kind: 'tagFilter', tags: ['b', 'a'], nextOnly: false, label: 'x' })?.id).toBe('b1');
    // nextOnly mismatch → not the same view
    expect(findBookmark(list, { kind: 'tagFilter', tags: ['a', 'b'], nextOnly: true, label: 'x' })).toBeUndefined();
  });

  it('flags a project bookmark as stale when the project is gone', () => {
    const doc: WorkspaceDocument = createDefaultWorkspace();
    const live = doc.projectsNodeId;
    expect(isBookmarkStale(doc, { id: 'b', label: 'x', kind: 'project', projectId: 'missing', color: '#fff' })).toBe(true);
    // a structural/non-project node is also "not a project"
    expect(isBookmarkStale(doc, { id: 'b', label: 'x', kind: 'project', projectId: live, color: '#fff' })).toBe(true);
    // tag filters are never stale
    expect(isBookmarkStale(doc, { id: 'b', label: 'x', kind: 'tagFilter', tags: ['a'], color: '#fff' })).toBe(false);
  });
});
