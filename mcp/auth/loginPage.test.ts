import { describe, expect, it } from 'vitest';
import { renderLoginPage } from './loginPage';

const base = { clientId: 'c1', redirectUri: 'https://x/cb', codeChallenge: 'ch', csrfToken: 'tok' };

describe('renderLoginPage consent copy', () => {
  it('is read-only by default — the copy says view-not-change (#1069)', () => {
    const html = renderLoginPage(base);
    expect(html).toContain('view them, not change them');
  });

  it('offers write only as an explicit, unticked opt-in checkbox (#1069)', () => {
    const html = renderLoginPage(base);
    expect(html).toContain('name="allow_write"');
    expect(html).toContain('make changes');
    expect(html).toContain('create, edit, and delete');
    // the checkbox must NOT be pre-checked — read-only is the default
    expect(html).not.toMatch(/name="allow_write"[^>]*checked/);
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
