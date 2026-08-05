import { describe, expect, it } from 'vitest';
import {
  SCOPE_READ,
  SCOPE_WRITE,
  SUPPORTED_SCOPES,
  constrainRefreshScopes,
  resolveGrantedScopes,
} from './scopes';

describe('resolveGrantedScopes', () => {
  it('grants the full supported set when nothing is requested', () => {
    expect(resolveGrantedScopes([])).toEqual([...SUPPORTED_SCOPES]);
  });

  it('honors a read-only request', () => {
    expect(resolveGrantedScopes([SCOPE_READ])).toEqual([SCOPE_READ]);
  });

  it('honors a read+write request', () => {
    expect(resolveGrantedScopes([SCOPE_READ, SCOPE_WRITE])).toEqual([SCOPE_READ, SCOPE_WRITE]);
  });

  it('adds the read baseline to a write request (write implies read)', () => {
    expect(resolveGrantedScopes([SCOPE_WRITE])).toEqual([SCOPE_READ, SCOPE_WRITE]);
  });

  it('does NOT broaden an all-unsupported request up to write — narrows to read (#1050)', () => {
    // The old fallback returned the full set here, silently granting write.
    expect(resolveGrantedScopes(['bogus'])).toEqual([SCOPE_READ]);
    expect(resolveGrantedScopes(['bogus', 'admin'])).toEqual([SCOPE_READ]);
  });

  it('drops unsupported scopes from a mixed request, keeping the read baseline', () => {
    expect(resolveGrantedScopes([SCOPE_WRITE, 'bogus'])).toEqual([SCOPE_READ, SCOPE_WRITE]);
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
