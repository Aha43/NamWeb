import { describe, expect, it } from 'vitest';
import {
  SCOPE_READ,
  SCOPE_WRITE,
  SUPPORTED_SCOPES,
  constrainRefreshScopes,
  resolveGrantedScopes,
} from './scopes';

describe('resolveGrantedScopes (#1069 opt-in write)', () => {
  it('grants read-only by default — no write without owner consent (#1050 safe default)', () => {
    expect(resolveGrantedScopes(false)).toEqual([SCOPE_READ]);
  });

  it('grants read + write ONLY when the owner consents (the sign-in checkbox)', () => {
    expect(resolveGrantedScopes(true)).toEqual([SCOPE_READ, SCOPE_WRITE]);
  });

  it('the write grant is exactly the supported set (read is the baseline)', () => {
    expect(resolveGrantedScopes(true)).toEqual([...SUPPORTED_SCOPES]);
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

  it('rejects widening beyond the grant (no read→write escalation)', () => {
    expect(() => constrainRefreshScopes([SCOPE_WRITE], [SCOPE_READ])).toThrow(/scope/i);
    expect(() => constrainRefreshScopes([SCOPE_READ, SCOPE_WRITE], [SCOPE_READ])).toThrow(/scope/i);
  });
});
