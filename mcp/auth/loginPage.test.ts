import { describe, expect, it } from 'vitest';
import { renderLoginPage } from './loginPage';
import { SCOPE_READ } from './scopes';

const base = { clientId: 'c1', redirectUri: 'https://x/cb', codeChallenge: 'ch' };

describe('renderLoginPage consent copy', () => {
  it('warns the connector can modify when write is granted (default, no scope requested)', () => {
    const html = renderLoginPage(base);
    expect(html).toContain('and modify');
    expect(html).toContain('create, edit, and delete');
  });

  it('says read-only when only nam.read is requested', () => {
    const html = renderLoginPage({ ...base, scope: SCOPE_READ });
    expect(html).toContain('but not change them');
    expect(html).not.toContain('and modify');
  });
});
