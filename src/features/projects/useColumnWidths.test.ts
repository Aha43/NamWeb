import { renderHook, act } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useColumnWidths, DEFAULT_COLUMN_WIDTH } from './useColumnWidths';

describe('useColumnWidths', () => {
  beforeEach(() => localStorage.clear());

  it('starts empty (columns fall back to the default width)', () => {
    const { result } = renderHook(() => useColumnWidths('p1'));
    expect(result.current.widths).toEqual({});
    expect(DEFAULT_COLUMN_WIDTH).toBe(256);
  });

  it('sets, clamps (200–640), and persists a width', () => {
    const { result } = renderHook(() => useColumnWidths('p1'));
    act(() => result.current.setWidth('c1', 999)); // over max → clamped to 640
    expect(result.current.widths.c1).toBe(640);
    act(() => result.current.setWidth('c1', 50)); // under min → clamped to 200
    expect(result.current.widths.c1).toBe(200);
    expect(JSON.parse(localStorage.getItem('namweb.column.widths.p1')!)).toEqual({ c1: 200 });
  });

  it('reads persisted widths on mount and resets one back to default', () => {
    localStorage.setItem('namweb.column.widths.p2', JSON.stringify({ c1: 320, c2: 400 }));
    const { result } = renderHook(() => useColumnWidths('p2'));
    expect(result.current.widths).toEqual({ c1: 320, c2: 400 });
    act(() => result.current.resetWidth('c1'));
    expect(result.current.widths).toEqual({ c2: 400 });
  });
});
