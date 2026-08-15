import { describe, expect, it } from 'vitest';
import { renderLoginPage } from './loginPage';

const base = { clientId: 'c1', redirectUri: 'https://x/cb', codeChallenge: 'ch', csrfToken: 'tok' };

describe('renderLoginPage consent copy', () => {
  it('states plainly that the connection can read and make changes (#1116 write by default)', () => {
    const html = renderLoginPage(base);
    expect(html).toContain('read and make changes');
    expect(html).toContain('create, edit, and delete');
  });

  it('has no write-consent checkbox — write is granted by default (#1116)', () => {
    const html = renderLoginPage(base);
    expect(html).not.toContain('name="allow_write"');
  });

  it('embeds the CSRF token and the brand mark', () => {
    const html = renderLoginPage(base);
    expect(html).toContain('name="_csrf" value="tok"');
    expect(html).toContain('<svg'); // branded logo
  });

  it('names the redirect destination host so an off-brand callback is visible (#1052)', () => {
    const html = renderLoginPage({ ...base, redirectUri: 'https://claude.ai/api/mcp/auth_callback' });
    expect(html).toContain('claude.ai');
    expect(html).toContain('returned to');
  });
});
