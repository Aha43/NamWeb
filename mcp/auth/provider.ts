// OAuth 2.1 Authorization Server provider, backed by Supabase identity (P1, #107).
//
// Implements the SDK's OAuthServerProvider so `mcpAuthRouter` can expose the full
// AS surface (metadata, /authorize, /token, /register DCR, /revoke). We issue
// opaque tokens (looked up in the AuthStore — no JWT signing to own) that map to a
// Supabase session, so each MCP request runs under that user's RLS.
//
// The whole auth concern is contained here + ./stores + ./supabaseIdentity, behind
// the OAuthServerProvider seam — so swapping to a managed AS later (Option 2/3 in
// the design doc) stays a provider replacement, not a rewrite.

import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import type { OAuthRegisteredClientsStore } from '@modelcontextprotocol/sdk/server/auth/clients.js';
import type {
  AuthorizationParams,
  OAuthServerProvider,
} from '@modelcontextprotocol/sdk/server/auth/provider.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import {
  InvalidClientMetadataError,
  InvalidGrantError,
  InvalidRequestError,
  InvalidTokenError,
} from '@modelcontextprotocol/sdk/server/auth/errors.js';
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import type { AuthSession, SupabaseClient } from '@supabase/supabase-js';

import { AuthStore, InMemoryAuthStore } from './stores';
import { constrainRefreshScopes, resolveGrantedScopes } from './scopes';
import { isRedirectUriAllowed, type RedirectAllowlist } from './redirectAllowlist';
import { clientForSession, listWorkspaceNames, signInWithPassword } from './supabaseIdentity';
import { renderLoginPage, renderNoWorkspacePage, renderWorkspacePicker } from './loginPage';
import { issueCsrf, verifyCsrf } from './csrf';

const AUTH_CODE_TTL_SECONDS = 600; // 10 min — time to complete the code exchange
const PENDING_LOGIN_TTL_SECONDS = 600; // 10 min — time to pick a workspace after sign-in

function opaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export interface SupabaseOAuthProviderOptions {
  accessTokenTtlSeconds?: number;
  store?: AuthStore;
  /** Origins an auth code may be redirected to (#1052). Default: not enforcing (local/dev). */
  redirectAllowlist?: RedirectAllowlist;
}

export class SupabaseOAuthProvider implements OAuthServerProvider {
  private readonly store: AuthStore;
  private readonly accessTtl: number;
  private readonly redirectAllowlist: RedirectAllowlist;

  constructor(opts: SupabaseOAuthProviderOptions = {}) {
    this.store = opts.store ?? new InMemoryAuthStore();
    // Keep our access-token TTL under Supabase's ~1h JWT so refreshes line up.
    this.accessTtl = opts.accessTokenTtlSeconds ?? 50 * 60;
    this.redirectAllowlist = opts.redirectAllowlist ?? { origins: [], enforce: false };
  }

  get clientsStore(): OAuthRegisteredClientsStore {
    return {
      getClient: (clientId) => this.store.getClient(clientId),
      // DCR: the register handler generates client_id/secret; we persist + echo back — but only for a
      // client whose every redirect_uri is on the origin allowlist (#1052), so an attacker can't
      // register a client that sends the auth code to their own callback.
      registerClient: async (client) => {
        const full = client as OAuthClientInformationFull;
        for (const uri of full.redirect_uris ?? []) {
          if (!isRedirectUriAllowed(uri, this.redirectAllowlist)) {
            throw new InvalidClientMetadataError(`redirect_uri origin not allowed: ${uri}`);
          }
        }
        await this.store.saveClient(full);
        return full;
      },
    };
  }

  /** Step 1: show the Supabase login page, carrying the OAuth params through to the POST. */
  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/html');
    res.send(
      renderLoginPage({
        clientId: client.client_id,
        redirectUri: params.redirectUri,
        codeChallenge: params.codeChallenge,
        state: params.state,
        scope: params.scopes?.join(' '),
        csrfToken: issueCsrf(res),
      }),
    );
  }

  /**
   * Step 2 (our own route, not part of OAuthServerProvider): the login form POST.
   * Authenticates against Supabase, then completes the OAuth redirect with a code.
   */
  handleLogin = async (req: Request, res: Response): Promise<void> => {
    const { email, password, client_id, redirect_uri, code_challenge, state, scope } =
      req.body ?? {};

    if (!client_id || !redirect_uri || !code_challenge) {
      res.status(400).send('Missing OAuth parameters');
      return;
    }
    const client = await this.store.getClient(client_id);
    if (!client || !client.redirect_uris.includes(redirect_uri)) {
      res.status(400).send('Unknown client or redirect_uri');
      return;
    }
    // Re-check the allowlist at login too (#1052) — defends against a client registered before the
    // allowlist was tightened, or any store manipulation.
    if (!isRedirectUriAllowed(redirect_uri, this.redirectAllowlist)) {
      res.status(400).send('redirect_uri is not an allowed destination.');
      return;
    }
    if (!verifyCsrf(req)) {
      res.status(403).send('Invalid or missing CSRF token — reload the sign-in page and retry.');
      return;
    }

    let session;
    try {
      session = await signInWithPassword(String(email ?? ''), String(password ?? ''));
    } catch {
      // Re-show the form with an error rather than failing the whole flow.
      res.status(401).setHeader('Content-Type', 'text/html');
      res.send(
        renderLoginPage({
          clientId: client_id,
          redirectUri: redirect_uri,
          codeChallenge: code_challenge,
          state,
          scope,
          csrfToken: issueCsrf(res),
          error: 'Sign-in failed — check your email and password.',
        }),
      );
      return;
    }

    const scopes = resolveGrantedScopes(scope ? String(scope).split(' ').filter(Boolean) : []);
    const base = {
      clientId: client_id,
      redirectUri: redirect_uri,
      codeChallenge: code_challenge,
      state,
      scopes,
      session,
    };

    // Resolve which workspace this connection acts on (choose-at-consent).
    const workspaces = await listWorkspaceNames(session);
    if (workspaces.length === 0) {
      res.setHeader('Content-Type', 'text/html');
      res.send(renderNoWorkspacePage());
      return;
    }
    if (workspaces.length === 1) {
      await this.issueCodeAndRedirect(res, { ...base, workspace: workspaces[0] });
      return;
    }

    // Several workspaces → hold the session server-side and let the user pick.
    const pendingId = opaqueToken();
    await this.store.savePendingLogin(pendingId, {
      ...base,
      expiresAt: nowSeconds() + PENDING_LOGIN_TTL_SECONDS,
    });
    res.setHeader('Content-Type', 'text/html');
    res.send(renderWorkspacePicker({ pendingId, workspaces, csrfToken: issueCsrf(res) }));
  };

  /**
   * Step 2b (our own route): the workspace-pick POST. Completes the flow for a user
   * who has more than one workspace, using the session held in the pending login.
   */
  handleSelectWorkspace = async (req: Request, res: Response): Promise<void> => {
    const { pending_id, workspace } = req.body ?? {};
    if (!pending_id || !workspace) {
      res.status(400).send('Missing workspace selection');
      return;
    }
    if (!verifyCsrf(req)) {
      res.status(403).send('Invalid or missing CSRF token — reload and retry.');
      return;
    }
    const pending = await this.store.takePendingLogin(String(pending_id));
    if (!pending || pending.expiresAt < nowSeconds()) {
      res.status(400).send('Sign-in expired — please reconnect.');
      return;
    }
    // The choice must be one the user actually owns (don't trust the form).
    const workspaces = await listWorkspaceNames(pending.session);
    if (!workspaces.includes(String(workspace))) {
      res.status(400).send('Unknown workspace.');
      return;
    }
    await this.issueCodeAndRedirect(res, { ...pending, workspace: String(workspace) });
  };

  /** Mint a single-use auth code carrying the chosen workspace, then redirect back. */
  private async issueCodeAndRedirect(
    res: Response,
    data: {
      clientId: string;
      redirectUri: string;
      codeChallenge: string;
      state?: string;
      scopes: string[];
      session: AuthSession;
      workspace: string;
    },
  ): Promise<void> {
    const code = opaqueToken();
    await this.store.saveCode(code, {
      clientId: data.clientId,
      codeChallenge: data.codeChallenge,
      redirectUri: data.redirectUri,
      scopes: data.scopes,
      session: data.session,
      workspace: data.workspace,
      expiresAt: nowSeconds() + AUTH_CODE_TTL_SECONDS,
    });
    const target = new URL(data.redirectUri);
    target.searchParams.set('code', code);
    if (data.state) target.searchParams.set('state', String(data.state));
    res.redirect(target.toString());
  }

  /** PKCE: the SDK token handler validates the verifier against this challenge. */
  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string,
  ): Promise<string> {
    const data = await this.store.getCode(authorizationCode);
    if (!data) throw new InvalidGrantError('Invalid or expired authorization code');
    return data.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string,
    _codeVerifier?: string,
    redirectUri?: string,
  ): Promise<OAuthTokens> {
    // Claim the code atomically (#1051 H2) — a DELETE…RETURNING so two concurrent exchanges can't
    // both read it and mint independent token families.
    const data = await this.store.takeCode(authorizationCode);
    if (!data || data.clientId !== client.client_id) {
      throw new InvalidGrantError('Invalid authorization code');
    }
    if (data.expiresAt < nowSeconds()) {
      throw new InvalidGrantError('Authorization code expired');
    }
    if (redirectUri && redirectUri !== data.redirectUri) {
      throw new InvalidGrantError('redirect_uri mismatch');
    }
    // Open a grant: the shared session/scope/workspace record every token of this authorization
    // references (#1051). The first refresh token is minted at generation 0.
    const grantId = opaqueToken();
    await this.store.saveGrant(grantId, {
      clientId: data.clientId,
      scopes: data.scopes,
      workspace: data.workspace,
      session: data.session,
      refreshGeneration: 0,
    });
    return this.issueTokens(grantId, data.scopes, 0);
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string,
    scopes?: string[],
  ): Promise<OAuthTokens> {
    // Non-consuming read — a refresh token is validated by GENERATION, not deleted, so a replay of a
    // superseded token is still detectable (#1051 M5).
    const data = await this.store.getRefreshToken(refreshToken);
    if (!data) throw new InvalidGrantError('Invalid refresh token');
    const grant = await this.store.getGrant(data.grantId);
    if (!grant || grant.clientId !== client.client_id) {
      throw new InvalidGrantError('Invalid refresh token');
    }
    // Reuse detection: a token minted before the grant's current generation was already superseded —
    // treat its use as a stolen-token replay and revoke the whole family (all access + refresh
    // tokens for the grant).
    if (data.generation !== grant.refreshGeneration) {
      if (data.generation < grant.refreshGeneration) {
        await this.store.deleteGrant(data.grantId);
        throw new InvalidGrantError('Refresh token reuse detected — this authorization was revoked.');
      }
      throw new InvalidGrantError('Invalid refresh token');
    }
    // A refresh may narrow but never widen the grant (#1050).
    const nextScopes = constrainRefreshScopes(scopes, grant.scopes);
    // Claim the next generation FIRST as a compare-and-swap (#1051 review, P2 + re-review). Winning the
    // CAS is the mutex: only the winner proceeds to refresh the upstream Supabase session, so two
    // concurrent refreshes can't both rotate/consume the upstream token and desync the stored session.
    // A loser (CAS already moved) is rejected here, before touching Supabase.
    const generation = await this.store.advanceGrant(data.grantId, data.generation);
    if (generation === null) throw new InvalidGrantError('Concurrent refresh — please retry.');
    try {
      // Winner only: refresh the Supabase session and store it on the GRANT (shared). No desync —
      // verifyAccessToken reads the same grant session. `return await` so a rejection here is caught.
      const { session } = await clientForSession(grant.session);
      await this.store.updateGrantSession(data.grantId, session);
      return await this.issueTokens(data.grantId, nextScopes, generation);
    } catch (err) {
      // The CAS advanced the generation, but the refresh didn't complete — no replacement token ever
      // reached the client. Roll the generation back so a retry of the still-current refresh token
      // succeeds instead of looking like reuse and revoking the whole family (#1051 re-review, P2
      // failure-atomicity). Safe under concurrency: losers were rejected at the CAS above, so nothing
      // else advanced during this critical section.
      await this.store.rollbackGeneration(data.grantId, generation);
      throw err;
    }
  }

  /** Verify an MCP access token and resolve the per-user Supabase client (in `extra`). */
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const data = await this.store.getAccessToken(token);
    if (!data) throw new InvalidTokenError('Invalid access token');
    if (data.expiresAt < nowSeconds()) {
      await this.store.deleteAccessToken(token);
      throw new InvalidTokenError('Access token expired');
    }
    const grant = await this.store.getGrant(data.grantId);
    if (!grant) throw new InvalidTokenError('Invalid access token'); // grant revoked
    // Build the user's Supabase client, refreshing the session if needed, and persist any rotation on
    // the GRANT so every token of this authorization (incl. the refresh token) sees the live session.
    const { client, session } = await clientForSession(grant.session);
    if (session !== grant.session) await this.store.updateGrantSession(data.grantId, session);

    return {
      token,
      clientId: grant.clientId,
      // THIS token's scopes (may be a narrowed subset of the grant), not the grant's full set —
      // otherwise a refresh-narrowed read-only token would still expose write tools (#1051 review, P1).
      scopes: data.scopes,
      expiresAt: data.expiresAt,
      extra: { supabase: client, workspace: grant.workspace },
    };
  }

  async revokeToken(
    client: OAuthClientInformationFull,
    request: OAuthTokenRevocationRequest,
  ): Promise<void> {
    if (!request.token) throw new InvalidRequestError('Missing token');
    // Resolve the token (access or refresh) to its grant, verify the caller owns it, then revoke the
    // whole family (#1051 M5). Unknown token → no-op (RFC 7009: revocation is idempotent).
    const access = await this.store.getAccessToken(request.token);
    const refresh = access ? undefined : await this.store.getRefreshToken(request.token);
    const grantId = access?.grantId ?? refresh?.grantId;
    if (!grantId) return;
    const grant = await this.store.getGrant(grantId);
    if (grant && grant.clientId !== client.client_id) {
      throw new InvalidRequestError('Token was not issued to this client');
    }
    await this.store.deleteGrant(grantId);
  }

  private async issueTokens(
    grantId: string,
    scopes: string[],
    generation: number,
  ): Promise<OAuthTokens> {
    const accessToken = opaqueToken();
    const refreshToken = opaqueToken();
    await this.store.saveAccessToken(accessToken, {
      grantId,
      scopes, // this token's scopes (enforced at /mcp) — a refresh may have narrowed them (#1051 review)
      expiresAt: nowSeconds() + this.accessTtl,
    });
    await this.store.saveRefreshToken(refreshToken, { grantId, generation });
    return {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: this.accessTtl,
      refresh_token: refreshToken,
      scope: scopes.join(' '),
    };
  }
}

/** Pull the per-user Supabase client that verifyAccessToken stashed on req.auth. */
export function supabaseClientFromAuth(auth: AuthInfo | undefined): SupabaseClient {
  const client = auth?.extra?.supabase as SupabaseClient | undefined;
  if (!client) throw new Error('No authenticated Supabase client on request');
  return client;
}
