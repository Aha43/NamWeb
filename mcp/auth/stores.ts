// Storage seam for the OAuth Authorization Server (P1 #107; grant/family model #1051).
//
// Everything stateful the AS needs lives behind this interface so the in-memory
// implementation here can be swapped for the persistent Postgres one (P4a).
//
// Grant/family model (#1051): the durable per-authorization state — the Supabase session, granted
// scopes, workspace — lives in ONE **grant** record. Access and refresh tokens are thin references
// to a grant, so (a) a session rotation is written once and both tokens see it (no desync), and
// (b) refresh tokens carry a generation checked against the grant's, giving reuse detection: a
// replayed (superseded) refresh token revokes the whole family.

import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { AuthSession } from '@supabase/supabase-js';

/** An issued auth code, bound to the PKCE challenge and the Supabase session captured at login. */
export interface AuthCodeData {
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  scopes: string[];
  session: AuthSession;
  /** Workspace row this connection acts on (chosen at consent). */
  workspace: string;
  expiresAt: number; // epoch seconds
}

/** The shared per-authorization record. Access + refresh tokens reference it by id. */
export interface GrantData {
  clientId: string;
  scopes: string[];
  workspace: string;
  /** The Supabase session; rotated in place (shared by every token of this grant). */
  session: AuthSession;
  /** The currently-valid refresh generation; a refresh token with a lower generation is a replay. */
  refreshGeneration: number;
}

/** An issued MCP access token → the grant it acts under, plus the scopes THIS token carries. A
 *  refresh may narrow scopes, so the per-token scopes can be a subset of the grant's (#1051 review):
 *  the resource endpoint must gate on these, not the grant's full set. */
export interface AccessTokenData {
  grantId: string;
  scopes: string[];
  expiresAt: number; // epoch seconds (our MCP token TTL)
}

/** An issued MCP refresh token → its grant + the generation it was minted at (kept, not deleted on
 *  use, so a replay of a superseded token is detectable). */
export interface RefreshTokenData {
  grantId: string;
  generation: number;
}

/**
 * A login that has authenticated but not yet picked a workspace — held server-side
 * between the credential POST and the workspace-selection POST (so the Supabase
 * session never travels through the browser). Short-lived, single use.
 */
export interface PendingLoginData {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state?: string;
  scopes: string[];
  session: AuthSession;
  expiresAt: number; // epoch seconds
}

export interface AuthStore {
  // --- Registered clients (Dynamic Client Registration) ---
  getClient(clientId: string): Promise<OAuthClientInformationFull | undefined>;
  saveClient(client: OAuthClientInformationFull): Promise<void>;

  // --- Authorization codes ---
  saveCode(code: string, data: AuthCodeData): Promise<void>;
  getCode(code: string): Promise<AuthCodeData | undefined>; // non-consuming (PKCE challenge lookup)
  takeCode(code: string): Promise<AuthCodeData | undefined>; // atomic single-use claim (#1051 H2)
  deleteCode(code: string): Promise<void>;

  // --- Grants (the shared session/family record) ---
  saveGrant(id: string, data: GrantData): Promise<void>;
  getGrant(id: string): Promise<GrantData | undefined>;
  updateGrantSession(id: string, session: AuthSession): Promise<void>; // rotation write (verify + refresh)
  /** Claim the next refresh generation as a compare-and-swap (#1051 review, P2 + re-review): bump the
   *  generation ONLY if it still equals `expectedGeneration`; returns the new generation, or null when a
   *  concurrent refresh already advanced it. This is a pure mutex — it does NOT write the session — so
   *  the caller can claim FIRST and let only the winner refresh the upstream Supabase session (avoiding
   *  two concurrent refreshes both rotating/consuming the upstream token). */
  advanceGrant(id: string, expectedGeneration: number): Promise<number | null>;
  /** Undo a won generation claim (#1051 re-review, P2 failure-atomicity): if advanceGrant advanced the
   *  generation to `advancedGeneration` but the winner's refresh path then failed (Supabase refresh /
   *  session store / token persistence), roll it back by one so the client's still-current refresh token
   *  works on retry instead of tripping reuse revocation. CAS-guarded on `advancedGeneration` so it only
   *  ever undoes OUR own claim — never a later, successful advance. */
  rollbackGeneration(id: string, advancedGeneration: number): Promise<void>;
  deleteGrant(id: string): Promise<void>; // cascades: drops the grant's access + refresh tokens

  // --- Access tokens ---
  saveAccessToken(token: string, data: AccessTokenData): Promise<void>;
  getAccessToken(token: string): Promise<AccessTokenData | undefined>;
  deleteAccessToken(token: string): Promise<void>;

  // --- Refresh tokens (kept for reuse detection; validated by generation, not deleted on use) ---
  saveRefreshToken(token: string, data: RefreshTokenData): Promise<void>;
  getRefreshToken(token: string): Promise<RefreshTokenData | undefined>;

  // --- Pending logins (authenticated, awaiting workspace pick; single use) ---
  savePendingLogin(id: string, data: PendingLoginData): Promise<void>;
  takePendingLogin(id: string): Promise<PendingLoginData | undefined>;
}

/** Process-local, non-persistent store. Fine for local P1; the Postgres store persists at P4a. */
export class InMemoryAuthStore implements AuthStore {
  private clients = new Map<string, OAuthClientInformationFull>();
  private codes = new Map<string, AuthCodeData>();
  private grants = new Map<string, GrantData>();
  private accessTokens = new Map<string, AccessTokenData>();
  private refreshTokens = new Map<string, RefreshTokenData>();
  private pendingLogins = new Map<string, PendingLoginData>();

  async getClient(clientId: string) {
    return this.clients.get(clientId);
  }
  async saveClient(client: OAuthClientInformationFull) {
    this.clients.set(client.client_id, client);
  }

  async saveCode(code: string, data: AuthCodeData) {
    this.codes.set(code, data);
  }
  async getCode(code: string) {
    return this.codes.get(code);
  }
  async takeCode(code: string) {
    const data = this.codes.get(code);
    this.codes.delete(code);
    return data;
  }
  async deleteCode(code: string) {
    this.codes.delete(code);
  }

  async saveGrant(id: string, data: GrantData) {
    this.grants.set(id, data);
  }
  async getGrant(id: string) {
    return this.grants.get(id);
  }
  async updateGrantSession(id: string, session: AuthSession) {
    const g = this.grants.get(id);
    if (g) this.grants.set(id, { ...g, session });
  }
  async advanceGrant(id: string, expectedGeneration: number) {
    const g = this.grants.get(id);
    if (!g) throw new Error(`No grant ${id}`);
    if (g.refreshGeneration !== expectedGeneration) return null; // lost the CAS — concurrent refresh
    const refreshGeneration = g.refreshGeneration + 1;
    this.grants.set(id, { ...g, refreshGeneration }); // pure mutex — session written separately by the winner
    return refreshGeneration;
  }
  async rollbackGeneration(id: string, advancedGeneration: number) {
    const g = this.grants.get(id);
    if (!g || g.refreshGeneration !== advancedGeneration) return; // gone, or someone else moved on — don't clobber
    this.grants.set(id, { ...g, refreshGeneration: advancedGeneration - 1 });
  }
  async deleteGrant(id: string) {
    this.grants.delete(id);
    for (const [t, d] of this.accessTokens) if (d.grantId === id) this.accessTokens.delete(t);
    for (const [t, d] of this.refreshTokens) if (d.grantId === id) this.refreshTokens.delete(t);
  }

  async saveAccessToken(token: string, data: AccessTokenData) {
    this.accessTokens.set(token, data);
  }
  async getAccessToken(token: string) {
    return this.accessTokens.get(token);
  }
  async deleteAccessToken(token: string) {
    this.accessTokens.delete(token);
  }

  async saveRefreshToken(token: string, data: RefreshTokenData) {
    this.refreshTokens.set(token, data);
  }
  async getRefreshToken(token: string) {
    return this.refreshTokens.get(token);
  }

  async savePendingLogin(id: string, data: PendingLoginData) {
    this.pendingLogins.set(id, data);
  }
  async takePendingLogin(id: string) {
    const data = this.pendingLogins.get(id);
    this.pendingLogins.delete(id);
    return data;
  }
}
