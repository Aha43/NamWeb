import { renderHook, act } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useMultiSelect } from './useMultiSelect';

describe('useMultiSelect (#921)', () => {
  it('toggles ids, selects all, clears, and exits (which also drops select mode)', () => {
    const { result } = renderHook(() => useMultiSelect());
    expect(result.current.selectMode).toBe(false);

    act(() => result.current.enter());
    expect(result.current.selectMode).toBe(true);

    act(() => result.current.toggle('a'));
    act(() => result.current.toggle('b'));
    expect([...result.current.selected]).toEqual(['a', 'b']);

    act(() => result.current.toggle('a')); // toggle off
    expect([...result.current.selected]).toEqual(['b']);

    act(() => result.current.selectAll(['a', 'b', 'c']));
    expect(result.current.selected.size).toBe(3);

    act(() => result.current.clear());
    expect(result.current.selected.size).toBe(0);
    expect(result.current.selectMode).toBe(true); // clear keeps select mode

    act(() => result.current.selectAll(['x']));
    act(() => result.current.exit());
    expect(result.current.selectMode).toBe(false);
    expect(result.current.selected.size).toBe(0); // exit also clears
  });
});
