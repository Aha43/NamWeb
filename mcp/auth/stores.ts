// Storage seam for the OAuth Authorization Server (P1, issue #107).
//
// Everything stateful the AS needs — registered clients (DCR), one-time auth
// codes, and issued access/refresh tokens — lives behind these interfaces so the
// in-memory implementation here can be swapped for a persistent one at P4 hosting
// (and so a future managed-AS swap stays a provider concern, not a rewrite).
//
// In-memory means: a server restart drops all of it, so connectors re-authorize.
// That is acceptable for the local-first P1; persistence is a P4 concern.

import type { OAuthClientInformationFull } from '@modelcontextprotocol/sdk/shared/auth.js';
import type { AuthSession } from '@supabase/supabase-js';

/** An issued auth code, bound to the PKCE challenge and the Supabase session captured at login. */
export interface AuthCodeData {
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  scopes: string[];
  session: AuthSession;
  expiresAt: number; // epoch seconds
}

/** An issued MCP access token → the Supabase session it acts as. */
export interface AccessTokenData {
  clientId: string;
  scopes: string[];
  session: AuthSession;
  expiresAt: number; // epoch seconds (our MCP token TTL)
}

/** An issued MCP refresh token → the Supabase session to refresh from. */
export interface RefreshTokenData {
  clientId: string;
  scopes: string[];
  session: AuthSession;
}

export interface AuthStore {
  // --- Registered clients (Dynamic Client Registration) ---
  getClient(clientId: string): Promise<OAuthClientInformationFull | undefined>;
  saveClient(client: OAuthClientInformationFull): Promise<void>;

  // --- Authorization codes (single use) ---
  saveCode(code: string, data: AuthCodeData): Promise<void>;
  getCode(code: string): Promise<AuthCodeData | undefined>;
  deleteCode(code: string): Promise<void>;

  // --- Access tokens ---
  saveAccessToken(token: string, data: AccessTokenData): Promise<void>;
  getAccessToken(token: string): Promise<AccessTokenData | undefined>;
  updateAccessSession(token: string, session: AuthSession): Promise<void>;
  deleteAccessToken(token: string): Promise<void>;

  // --- Refresh tokens (single use — Supabase rotates them) ---
  saveRefreshToken(token: string, data: RefreshTokenData): Promise<void>;
  takeRefreshToken(token: string): Promise<RefreshTokenData | undefined>;
}

/** Process-local, non-persistent store. Fine for local P1; replace at P4. */
export class InMemoryAuthStore implements AuthStore {
  private clients = new Map<string, OAuthClientInformationFull>();
  private codes = new Map<string, AuthCodeData>();
  private accessTokens = new Map<string, AccessTokenData>();
  private refreshTokens = new Map<string, RefreshTokenData>();

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
  async deleteCode(code: string) {
    this.codes.delete(code);
  }

  async saveAccessToken(token: string, data: AccessTokenData) {
    this.accessTokens.set(token, data);
  }
  async getAccessToken(token: string) {
    return this.accessTokens.get(token);
  }
  async updateAccessSession(token: string, session: AuthSession) {
    const existing = this.accessTokens.get(token);
    if (existing) this.accessTokens.set(token, { ...existing, session });
  }
  async deleteAccessToken(token: string) {
    this.accessTokens.delete(token);
  }

  async saveRefreshToken(token: string, data: RefreshTokenData) {
    this.refreshTokens.set(token, data);
  }
  async takeRefreshToken(token: string) {
    const data = this.refreshTokens.get(token);
    this.refreshTokens.delete(token);
    return data;
  }
}
