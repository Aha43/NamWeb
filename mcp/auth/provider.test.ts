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
const { SCOPE_READ, SCOPE_WRITE } = await import('./scopes');

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
    expect(tokens.scope).toBe('nam.read nam.write'); // write granted by default (#1116)
    expect(signInWithPassword).toHaveBeenCalledWith('me@nam.local', 'pw');
  });

  it('verifyAccessToken resolves the per-user Supabase client onto auth.extra', async () => {
    const code = await login();
    const tokens = await provider.exchangeAuthorizationCode(client, code, 'verifier', REDIRECT_URI);

    const info = await provider.verifyAccessToken(tokens.access_token);
    expect(info.clientId).toBe(client.client_id);
    expect(info.scopes).toEqual([SCOPE_READ, SCOPE_WRITE]);
    expect(supabaseClientFromAuth(info)).toBe(fakeSupabase);
  });

  it('grants read + write to every signed-in connection by default (#1116)', async () => {
    const code = await login();
    const tokens = await provider.exchangeAuthorizationCode(client, code, 'verifier', REDIRECT_URI);
    expect(tokens.scope).toBe('nam.read nam.write');
    const info = await provider.verifyAccessToken(tokens.access_token);
    expect(info.scopes).toEqual([SCOPE_READ, SCOPE_WRITE]);
  });

  it('grants the default read+write regardless of the client-requested scope (the sign-in is the authority)', async () => {
    // The grant is fixed at the server, not taken from the client's requested `scope` (#1050/#1116).
    const code = await login({ scope: 'nam.read' }); // client asks for read-only; grant is still read+write
    const tokens = await provider.exchangeAuthorizationCode(client, code, 'verifier', REDIRECT_URI);
    const info = await provider.verifyAccessToken(tokens.access_token);
    expect(info.scopes).toEqual([SCOPE_READ, SCOPE_WRITE]);
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

  it('rejects a refresh that requests a scope outside the grant (#1050)', async () => {
    const code = await login(); // granted read + write (#1116)
    const first = await provider.exchangeAuthorizationCode(client, code, 'verifier', REDIRECT_URI);
    // A scope the grant never included must be rejected (invalid_scope), not silently escalated —
    // write is already in the grant now, so widening can only mean an out-of-grant scope.
    await expect(
      provider.exchangeRefreshToken(client, first.refresh_token!, ['nam.read', 'nam.admin']),
    ).rejects.toThrow(/scope/i);
  });

  it('narrows scope on refresh — and ENFORCES it at the token, not just the response (#1051 review, P1)', async () => {
    const code = await login(); // granted read+write by default (#1116)
    const first = await provider.exchangeAuthorizationCode(client, code, 'verifier', REDIRECT_URI);
    const refreshed = await provider.exchangeRefreshToken(client, first.refresh_token!, ['nam.read']);
    expect(refreshed.scope).toBe('nam.read');
    // The access token itself must carry only nam.read — otherwise /mcp would still expose write tools.
    const info = await provider.verifyAccessToken(refreshed.access_token);
    expect(info.scopes).toEqual(['nam.read']);
  });

  it('reuse of a rotated (superseded) refresh token revokes the whole family (#1051)', async () => {
    const code = await login();
    const first = await provider.exchangeAuthorizationCode(client, code, 'verifier', REDIRECT_URI);
    const second = await provider.exchangeRefreshToken(client, first.refresh_token!); // rotate
    // Replaying the OLD token is treated as theft → the family is revoked, so even the CURRENT
    // (second) refresh token stops working.
    await expect(provider.exchangeRefreshToken(client, first.refresh_token!)).rejects.toThrow(/reuse/i);
    await expect(provider.exchangeRefreshToken(client, second.refresh_token!)).rejects.toThrow();
  });

  it('revoking a token revokes the whole grant; another client cannot revoke it (#1051)', async () => {
    const code = await login();
    const tokens = await provider.exchangeAuthorizationCode(client, code, 'verifier', REDIRECT_URI);
    const other = { client_id: 'other-client', redirect_uris: [REDIRECT_URI] } as OAuthClientInformationFull;
    // Ownership: a different client may not revoke this token.
    await expect(provider.revokeToken(other, { token: tokens.access_token })).rejects.toThrow();
    // The owner revokes → BOTH the access and refresh tokens stop working (family revoked).
    await provider.revokeToken(client, { token: tokens.access_token });
    await expect(provider.verifyAccessToken(tokens.access_token)).rejects.toThrow();
    await expect(provider.exchangeRefreshToken(client, tokens.refresh_token!)).rejects.toThrow();
  });

  it('a session rotation at verify time is seen by the next refresh — no desync (#1051)', async () => {
    const rotated = fakeSession({ access_token: 'rotated-token' });
    // First clientForSession call (at verify) returns a ROTATED session; later calls echo their input.
    clientForSession
      .mockReset()
      .mockImplementationOnce(async () => ({ client: fakeSupabase, session: rotated }))
      .mockImplementation(async (session: AuthSession) => ({ client: fakeSupabase, session }));

    const code = await login();
    const tokens = await provider.exchangeAuthorizationCode(client, code, 'verifier', REDIRECT_URI);
    await provider.verifyAccessToken(tokens.access_token); // rotates the GRANT session
    await provider.exchangeRefreshToken(client, tokens.refresh_token!); // must use the rotated session

    // The refresh's clientForSession was called with the rotated session, not the stale original.
    const calls = clientForSession.mock.calls;
    const lastArg = calls[calls.length - 1]?.[0] as AuthSession;
    expect(lastArg.access_token).toBe('rotated-token');
  });

  it('two concurrent refreshes of the same token: only the lock winner refreshes Supabase (#1051 re-review)', async () => {
    const code = await login();
    const tokens = await provider.exchangeAuthorizationCode(client, code, 'verifier', REDIRECT_URI);
    clientForSession.mockClear(); // count only the refresh-time calls, not login/verify

    // Fire both with the SAME refresh token. Claim-first: one wins the in-progress lock and refreshes the
    // upstream session; the other fails to claim and is rejected BEFORE calling clientForSession — so the
    // upstream Supabase token is rotated exactly once (no double-rotate/desync).
    const [a, b] = await Promise.allSettled([
      provider.exchangeRefreshToken(client, tokens.refresh_token!),
      provider.exchangeRefreshToken(client, tokens.refresh_token!),
    ]);
    const outcomes = [a.status, b.status].sort();
    expect(outcomes).toEqual(['fulfilled', 'rejected']);
    const rejected = (a.status === 'rejected' ? a : b) as PromiseRejectedResult;
    expect(String(rejected.reason)).toMatch(/concurrent refresh/i);
    expect(clientForSession).toHaveBeenCalledTimes(1); // only the winner touched Supabase
  });

  it('a duplicate refresh while the winner is still in-flight is told to retry, NOT treated as reuse (#1051 re-review v3)', async () => {
    const code = await login();
    const first = await provider.exchangeAuthorizationCode(client, code, 'verifier', REDIRECT_URI);

    // Park the winner mid-refresh (inside clientForSession) so it holds the in-progress lock but has NOT
    // yet issued the new token or advanced the generation.
    let unblock!: () => void;
    const gate = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    clientForSession.mockImplementationOnce(async (session: AuthSession) => {
      await gate;
      return { client: fakeSupabase, session };
    });
    const winner = provider.exchangeRefreshToken(client, first.refresh_token!);
    await new Promise((r) => setTimeout(r, 0)); // let the winner acquire the lock and park on the gate

    // A duplicate of the SAME still-current token arrives during the in-flight window. It must be told to
    // retry — NOT deleted as reuse (the bug: generation would have advanced before a replacement existed).
    await expect(provider.exchangeRefreshToken(client, first.refresh_token!)).rejects.toThrow(
      /concurrent refresh/i,
    );

    // The winner completes and the family is intact — the duplicate did not revoke the grant mid-flight.
    unblock();
    const done = await winner;
    expect(done.refresh_token).toBeTruthy();
    const info = await provider.verifyAccessToken(done.access_token);
    expect(info.clientId).toBe(client.client_id);
  });

  it('releases the lock when the winner path fails, so the old token still refreshes (#1051 re-review, P2)', async () => {
    const code = await login();
    const first = await provider.exchangeAuthorizationCode(client, code, 'verifier', REDIRECT_URI);

    // The winner claimed the lock, then the Supabase refresh fails transiently (before finalize).
    clientForSession.mockRejectedValueOnce(new Error('supabase transient'));
    await expect(provider.exchangeRefreshToken(client, first.refresh_token!)).rejects.toThrow(
      /supabase transient/,
    );

    // The lock was released and the generation never advanced, so retrying the SAME refresh token
    // succeeds — it is NOT mistaken for reuse, and the family is NOT revoked.
    const second = await provider.exchangeRefreshToken(client, first.refresh_token!);
    expect(second.refresh_token).toBeTruthy();
    expect(second.access_token).not.toBe(first.access_token);
    const info = await provider.verifyAccessToken(second.access_token);
    expect(info.clientId).toBe(client.client_id);
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

describe('SupabaseOAuthProvider — redirect allowlist (#1052)', () => {
  // REDIRECT_URI is https://connector.example/callback → origin https://connector.example
  const allowed = { origins: ['https://connector.example'], enforce: true };

  it('registers a client whose redirect origin is allowed', async () => {
    const provider = new SupabaseOAuthProvider({ redirectAllowlist: allowed });
    await expect(provider.clientsStore.registerClient!(registeredClient())).resolves.toBeDefined();
  });

  it('rejects registering a client that would redirect the code off the allowlist (phishing)', async () => {
    const provider = new SupabaseOAuthProvider({ redirectAllowlist: allowed });
    const rogue = {
      client_id: 'rogue',
      redirect_uris: ['https://evil.example/callback'],
    } as OAuthClientInformationFull;
    await expect(provider.clientsStore.registerClient!(rogue)).rejects.toThrow(/redirect_uri/i);
  });

  it('does not enforce when the allowlist is off (local/dev)', async () => {
    const provider = new SupabaseOAuthProvider(); // default: not enforcing
    const any = {
      client_id: 'x',
      redirect_uris: ['https://anywhere.example/cb'],
    } as OAuthClientInformationFull;
    await expect(provider.clientsStore.registerClient!(any)).resolves.toBeDefined();
  });
});
