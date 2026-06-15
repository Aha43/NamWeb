// P1 verification for the OAuth 2.1 Authorization Server (issue #107). Exercises the
// SupabaseOAuthProvider end-to-end at the provider seam: DCR → login → PKCE code →
// token exchange → access-token verify → refresh rotation → revoke, plus the failure
// paths. `./supabaseIdentity` is mocked, so no live Supabase is needed.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthSession, SupabaseClient } from '@supabase/supabase-js';
import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';

const signInWithPassword = vi.fn();
const clientForSession = vi.fn();
const listWorkspaceNames = vi.fn();
vi.mock('./supabaseIdentity', () => ({ signInWithPassword, clientForSession, listWorkspaceNames }));

// Imported after the mock is registered.
const { SupabaseOAuthProvider, supabaseClientFromAuth } = await import('./provider');

// --- Fakes -----------------------------------------------------------------

function fakeSession(over: Partial<AuthSession> = {}): AuthSession {
  return {
    access_token: 'supa-access',
    refresh_token: 'supa-refresh',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: { id: 'user-1' },
    ...over,
  } as AuthSession;
}

const fakeSupabase = { __brand: 'supabase' } as unknown as SupabaseClient;

const CSRF = 'csrf-token';

/** A request body + matching CSRF cookie header (double-submit pair). */
function reqWith(body: Record<string, string>, csrf: string = CSRF) {
  return { body: { ...body, _csrf: csrf }, headers: { cookie: `nam_csrf=${CSRF}` } };
}

/** Minimal Express-like response that records what the provider does to it. */
function fakeRes() {
  return {
    statusCode: 200,
    headers: {} as Record<string, string>,
    cookies: {} as Record<string, string>,
    body: undefined as string | undefined,
    redirectUrl: undefined as string | undefined,
    req: { secure: false },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(key: string, value: string) {
      this.headers[key] = value;
      return this;
    },
    cookie(name: string, value: string) {
      this.cookies[name] = value;
      return this;
    },
    send(body: string) {
      this.body = body;
      return this;
    },
    redirect(url: string) {
      this.redirectUrl = url;
      return this;
    },
  };
}

const REDIRECT_URI = 'https://connector.example/callback';
const CODE_CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

function registeredClient(): OAuthClientInformationFull {
  return {
    client_id: 'client-abc',
    redirect_uris: [REDIRECT_URI],
  } as OAuthClientInformationFull;
}

// --- Suite -----------------------------------------------------------------

describe('SupabaseOAuthProvider', () => {
  let provider: InstanceType<typeof SupabaseOAuthProvider>;
  let client: OAuthClientInformationFull;

  beforeEach(async () => {
    signInWithPassword.mockReset().mockResolvedValue(fakeSession());
    clientForSession.mockReset().mockImplementation(async (session: AuthSession) => ({
      client: fakeSupabase,
      session,
    }));
    // Default: a single workspace, so the login flow completes in one step.
    listWorkspaceNames.mockReset().mockResolvedValue(['default']);
    provider = new SupabaseOAuthProvider();
    client = registeredClient();
    await provider.clientsStore.registerClient!(client);
  });

  /** Drive the login form POST and return the authorization code from the redirect. */
  async function login(body: Record<string, string> = {}): Promise<string> {
    const res = fakeRes();
    await provider.handleLogin(
      reqWith({
        email: 'me@nam.local',
        password: 'pw',
        client_id: client.client_id,
        redirect_uri: REDIRECT_URI,
        code_challenge: CODE_CHALLENGE,
        state: 'xyz',
        scope: 'nam.read',
        ...body,
      }) as never,
      res as never,
    );
    expect(res.redirectUrl, 'login should redirect with a code').toBeDefined();
    const url = new URL(res.redirectUrl!);
    expect(url.searchParams.get('state')).toBe('xyz');
    return url.searchParams.get('code')!;
  }

  it('round-trips DCR → login → PKCE code exchange → access token', async () => {
    const code = await login();

    // PKCE: the SDK token handler reads the bound challenge back from us.
    expect(await provider.challengeForAuthorizationCode(client, code)).toBe(CODE_CHALLENGE);

    const tokens = await provider.exchangeAuthorizationCode(client, code, 'verifier', REDIRECT_URI);
    expect(tokens.access_token).toBeTruthy();
    expect(tokens.refresh_token).toBeTruthy();
    expect(tokens.token_type).toBe('bearer');
    expect(tokens.scope).toBe('nam.read');
    expect(signInWithPassword).toHaveBeenCalledWith('me@nam.local', 'pw');
  });

  it('verifyAccessToken resolves the per-user Supabase client onto auth.extra', async () => {
    const code = await login();
    const tokens = await provider.exchangeAuthorizationCode(client, code, 'verifier', REDIRECT_URI);

    const info = await provider.verifyAccessToken(tokens.access_token);
    expect(info.clientId).toBe(client.client_id);
    expect(info.scopes).toEqual(['nam.read']);
    expect(supabaseClientFromAuth(info)).toBe(fakeSupabase);
  });

  it('rotates the refresh token and invalidates the old one', async () => {
    const code = await login();
    const first = await provider.exchangeAuthorizationCode(client, code, 'verifier', REDIRECT_URI);

    const second = await provider.exchangeRefreshToken(client, first.refresh_token!);
    expect(second.access_token).not.toBe(first.access_token);
    expect(second.refresh_token).not.toBe(first.refresh_token);

    // The consumed refresh token must not work twice.
    await expect(provider.exchangeRefreshToken(client, first.refresh_token!)).rejects.toThrow();
  });

  it('revokeToken invalidates the access token', async () => {
    const code = await login();
    const tokens = await provider.exchangeAuthorizationCode(client, code, 'verifier', REDIRECT_URI);

    await provider.revokeToken(client, { token: tokens.access_token });
    await expect(provider.verifyAccessToken(tokens.access_token)).rejects.toThrow(/Invalid/);
  });

  it('makes each authorization code single-use', async () => {
    const code = await login();
    await provider.exchangeAuthorizationCode(client, code, 'verifier', REDIRECT_URI);
    await expect(
      provider.exchangeAuthorizationCode(client, code, 'verifier', REDIRECT_URI),
    ).rejects.toThrow(/Invalid authorization code/);
  });

  it('rejects a redirect_uri mismatch at code exchange', async () => {
    const code = await login();
    await expect(
      provider.exchangeAuthorizationCode(client, code, 'verifier', 'https://evil.example/cb'),
    ).rejects.toThrow(/redirect_uri mismatch/);
  });

  it('re-renders the login form on a failed Supabase sign-in (no code issued)', async () => {
    signInWithPassword.mockRejectedValueOnce(new Error('bad creds'));
    const res = fakeRes();
    await provider.handleLogin(
      reqWith({
        email: 'me@nam.local',
        password: 'wrong',
        client_id: client.client_id,
        redirect_uri: REDIRECT_URI,
        code_challenge: CODE_CHALLENGE,
        state: 'xyz',
        scope: 'nam.read',
      }) as never,
      res as never,
    );
    expect(res.redirectUrl).toBeUndefined();
    expect(res.statusCode).toBe(401);
    expect(res.body).toContain('Sign-in failed');
  });

  it('rejects a login POST with a missing/mismatched CSRF token', async () => {
    const res = fakeRes();
    await provider.handleLogin(
      {
        body: {
          email: 'me@nam.local',
          password: 'pw',
          client_id: client.client_id,
          redirect_uri: REDIRECT_URI,
          code_challenge: CODE_CHALLENGE,
          _csrf: 'wrong',
        },
        headers: { cookie: `nam_csrf=${CSRF}` },
      } as never,
      res as never,
    );
    expect(res.statusCode).toBe(403);
    expect(res.redirectUrl).toBeUndefined();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('rejects login for an unknown client or redirect_uri', async () => {
    const res = fakeRes();
    await provider.handleLogin(
      {
        body: {
          email: 'me@nam.local',
          password: 'pw',
          client_id: client.client_id,
          redirect_uri: 'https://evil.example/cb',
          code_challenge: CODE_CHALLENGE,
        },
      } as never,
      res as never,
    );
    expect(res.statusCode).toBe(400);
    expect(res.redirectUrl).toBeUndefined();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('rejects an unknown access token', async () => {
    await expect(provider.verifyAccessToken('nope')).rejects.toThrow(/Invalid access token/);
  });

  it('supabaseClientFromAuth throws when no client was attached', () => {
    expect(() => supabaseClientFromAuth(undefined)).toThrow(/No authenticated Supabase client/);
  });

  describe('workspace selection (choose-at-consent)', () => {
    it('carries the single workspace through code → token → verify', async () => {
      const code = await login(); // single workspace 'default'
      const tokens = await provider.exchangeAuthorizationCode(client, code, 'v', REDIRECT_URI);
      const info = await provider.verifyAccessToken(tokens.access_token);
      expect(info.extra?.workspace).toBe('default');
    });

    it('shows a picker (no code) when the user has several workspaces', async () => {
      listWorkspaceNames.mockResolvedValue(['default', 'dev']);
      const res = fakeRes();
      await provider.handleLogin(loginBody() as never, res as never);

      expect(res.redirectUrl).toBeUndefined();
      expect(res.body).toContain('Choose a workspace');
      expect(res.body).toContain('dev');
    });

    it('issues a code for the picked workspace via select-workspace', async () => {
      listWorkspaceNames.mockResolvedValue(['default', 'dev']);
      const loginRes = fakeRes();
      await provider.handleLogin(loginBody() as never, loginRes as never);
      const pendingId = /name="pending_id" value="([^"]+)"/.exec(loginRes.body!)![1];

      const res = fakeRes();
      await provider.handleSelectWorkspace(
        reqWith({ pending_id: pendingId, workspace: 'dev' }) as never,
        res as never,
      );
      const code = new URL(res.redirectUrl!).searchParams.get('code')!;
      const tokens = await provider.exchangeAuthorizationCode(client, code, 'v', REDIRECT_URI);
      const info = await provider.verifyAccessToken(tokens.access_token);
      expect(info.extra?.workspace).toBe('dev');
    });

    it('rejects a workspace the user does not own', async () => {
      listWorkspaceNames.mockResolvedValue(['default', 'dev']);
      const loginRes = fakeRes();
      await provider.handleLogin(loginBody() as never, loginRes as never);
      const pendingId = /name="pending_id" value="([^"]+)"/.exec(loginRes.body!)![1];

      const res = fakeRes();
      await provider.handleSelectWorkspace(
        reqWith({ pending_id: pendingId, workspace: 'someone-else' }) as never,
        res as never,
      );
      expect(res.statusCode).toBe(400);
      expect(res.redirectUrl).toBeUndefined();
    });

    it('shows a no-workspace page when the user has none', async () => {
      listWorkspaceNames.mockResolvedValue([]);
      const res = fakeRes();
      await provider.handleLogin(loginBody() as never, res as never);
      expect(res.redirectUrl).toBeUndefined();
      expect(res.body).toContain('create one first');
    });
  });

  function loginBody() {
    return reqWith({
      email: 'me@nam.local',
      password: 'pw',
      client_id: client.client_id,
      redirect_uri: REDIRECT_URI,
      code_challenge: CODE_CHALLENGE,
      state: 'xyz',
      scope: 'nam.read',
    });
  }
});
