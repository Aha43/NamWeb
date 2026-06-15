import { describe, expect, it } from 'vitest';
import { SCOPE_READ, SCOPE_WRITE, SUPPORTED_SCOPES, resolveGrantedScopes } from './scopes';

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

  it('drops unsupported scopes, falling back to the full set if none remain', () => {
    expect(resolveGrantedScopes(['bogus'])).toEqual([...SUPPORTED_SCOPES]);
    expect(resolveGrantedScopes([SCOPE_WRITE, 'bogus'])).toEqual([SCOPE_WRITE]);
  });
});
