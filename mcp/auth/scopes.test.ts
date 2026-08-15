import { describe, expect, it } from 'vitest';
import {
  SCOPE_READ,
  SCOPE_WRITE,
  SUPPORTED_SCOPES,
  constrainRefreshScopes,
  resolveGrantedScopes,
} from './scopes';

describe('resolveGrantedScopes (#1116 write by default)', () => {
  it('grants read + write to every signed-in connection (the consent checkbox is retired)', () => {
    expect(resolveGrantedScopes()).toEqual([SCOPE_READ, SCOPE_WRITE]);
  });

  it('the grant is exactly the supported set (read is the baseline)', () => {
    expect(resolveGrantedScopes()).toEqual([...SUPPORTED_SCOPES]);
  });
});

describe('constrainRefreshScopes (#1050)', () => {
  it('keeps the full grant when the refresh requests no scopes', () => {
    expect(constrainRefreshScopes(undefined, [SCOPE_READ, SCOPE_WRITE])).toEqual([SCOPE_READ, SCOPE_WRITE]);
    expect(constrainRefreshScopes([], [SCOPE_READ])).toEqual([SCOPE_READ]);
  });

  it('allows narrowing to a subset of the grant', () => {
    expect(constrainRefreshScopes([SCOPE_READ], [SCOPE_READ, SCOPE_WRITE])).toEqual([SCOPE_READ]);
  });

  it('normalizes a write-only refresh request to include read (write implies read; /mcp needs read) (#1116 review P3)', () => {
    // A write-only token would exchange fine yet be unusable (the resource endpoint requires nam.read).
    expect(constrainRefreshScopes([SCOPE_WRITE], [SCOPE_READ, SCOPE_WRITE])).toEqual([SCOPE_READ, SCOPE_WRITE]);
    // An explicit read+write request is unchanged.
    expect(constrainRefreshScopes([SCOPE_READ, SCOPE_WRITE], [SCOPE_READ, SCOPE_WRITE])).toEqual([SCOPE_READ, SCOPE_WRITE]);
  });

  it('rejects widening beyond the grant (no read→write escalation)', () => {
    expect(() => constrainRefreshScopes([SCOPE_WRITE], [SCOPE_READ])).toThrow(/scope/i);
    expect(() => constrainRefreshScopes([SCOPE_READ, SCOPE_WRITE], [SCOPE_READ])).toThrow(/scope/i);
  });
});
