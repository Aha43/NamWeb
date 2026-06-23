import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useCollapsedSections } from './useCollapsedSections';
import { useCollapsedDetails } from './useCollapsedDetails';

// #279 — a project workbench lands with every section collapsed for a clean overview.
describe('workbench collapse defaults', () => {
  beforeEach(() => localStorage.clear());

  it('collapses Actions + Sub-projects on first open (no stored value)', () => {
    const { result } = renderHook(() => useCollapsedSections('p1'));
    expect(result.current[0]).toEqual(new Set(['actions', 'subprojects']));
  });

  it('collapses the Details panel on first open', () => {
    expect(renderHook(() => useCollapsedDetails('p1')).result.current[0]).toBe(true);
  });

  it('treats a stored value as authoritative — an expanded choice ("[]") stays expanded', () => {
    localStorage.setItem('namweb.collapsed.sections.p2', '[]');
    const { result } = renderHook(() => useCollapsedSections('p2'));
    expect(result.current[0]).toEqual(new Set());
  });
});
