import { describe, expect, it } from 'vitest';
import { isRedirectUriAllowed, loadRedirectAllowlist } from './redirectAllowlist';

describe('loadRedirectAllowlist (#1052)', () => {
  it('does not enforce in a local/dev context with no list', () => {
    expect(loadRedirectAllowlist({})).toEqual({ origins: [], enforce: false });
    expect(loadRedirectAllowlist({ NAM_MCP_ISSUER_URL: 'http://127.0.0.1:3333' }).enforce).toBe(false);
  });

  it('fails closed (enforce, empty list) in a deployment with the list unset', () => {
    expect(loadRedirectAllowlist({ NODE_ENV: 'production' })).toEqual({ origins: [], enforce: true });
    expect(loadRedirectAllowlist({ NAM_MCP_ISSUER_URL: 'https://mcp.example.com' }).enforce).toBe(true);
  });

  it('parses + enforces a configured origin list (even in dev)', () => {
    const a = loadRedirectAllowlist({ NAM_MCP_ALLOWED_REDIRECT_ORIGINS: 'https://claude.ai, https://chatgpt.com' });
    expect(a).toEqual({ origins: ['https://claude.ai', 'https://chatgpt.com'], enforce: true });
  });
});

describe('isRedirectUriAllowed (#1052)', () => {
  const allow = { origins: ['https://claude.ai'], enforce: true };

  it('allows a URI whose origin is on the list', () => {
    expect(isRedirectUriAllowed('https://claude.ai/api/mcp/auth_callback', allow)).toBe(true);
  });

  it('rejects an off-list origin (the phishing redirect)', () => {
    expect(isRedirectUriAllowed('https://evil.example.com/callback', allow)).toBe(false);
    expect(isRedirectUriAllowed('http://claude.ai/x', allow)).toBe(false); // scheme differs → different origin
  });

  it('rejects an unparseable URI', () => {
    expect(isRedirectUriAllowed('not a url', allow)).toBe(false);
  });

  it('allows anything when not enforcing (local/dev)', () => {
    expect(isRedirectUriAllowed('https://evil.example.com', { origins: [], enforce: false })).toBe(true);
  });
});
