import { describe, expect, it } from 'vitest';
import { columnDroppableId, resolveColumnDrop, type ColumnActions } from './columnDnd';

const columns: ColumnActions[] = [
  { id: 'c1', actionIds: ['a', 'b', 'c'] },
  { id: 'c2', actionIds: ['x', 'y'] },
  { id: 'c3', actionIds: [] },
];

describe('resolveColumnDrop', () => {
  it('reorders within a column when dropped onto a sibling row', () => {
    expect(resolveColumnDrop(columns, 'a', 'c')).toEqual({
      actionId: 'a',
      fromColumnId: 'c1',
      toColumnId: 'c1',
      targetActionIds: ['b', 'c', 'a'],
    });
  });

  it('moves to the end when dropped onto its own column shell', () => {
    expect(resolveColumnDrop(columns, 'a', columnDroppableId('c1'))?.targetActionIds).toEqual(['b', 'c', 'a']);
  });

  it('returns null for a no-op (dropped onto itself)', () => {
    expect(resolveColumnDrop(columns, 'a', 'a')).toBeNull();
  });

  it('reparents into another column at the dropped row index', () => {
    expect(resolveColumnDrop(columns, 'a', 'y')).toEqual({
      actionId: 'a',
      fromColumnId: 'c1',
      toColumnId: 'c2',
      targetActionIds: ['x', 'a', 'y'],
    });
  });

  it('reparents into an empty column dropped on its shell', () => {
    expect(resolveColumnDrop(columns, 'a', columnDroppableId('c3'))).toEqual({
      actionId: 'a',
      fromColumnId: 'c1',
      toColumnId: 'c3',
      targetActionIds: ['a'],
    });
  });

  it('appends when reparenting onto a column shell that already has actions', () => {
    expect(resolveColumnDrop(columns, 'a', columnDroppableId('c2'))?.targetActionIds).toEqual(['x', 'y', 'a']);
  });

  it('returns null when the dragged id belongs to no column', () => {
    expect(resolveColumnDrop(columns, 'ghost', 'a')).toBeNull();
  });

  it('returns null when the drop target is unresolvable', () => {
    expect(resolveColumnDrop(columns, 'a', 'ghost')).toBeNull();
  });
});
