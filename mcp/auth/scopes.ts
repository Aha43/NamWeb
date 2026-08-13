// OAuth scopes for the Nam MCP connector. Two granted capabilities so the consent
// is honest: read access to the workspace, and write access (the P2 mutation tools).
// `nam.read` is the baseline every token carries (write implies read); the resource
// endpoint requires it, and the write tools additionally require `nam.write`.

import { InvalidScopeError } from '@modelcontextprotocol/sdk/server/auth/errors.js';

export const SCOPE_READ = 'nam.read';
export const SCOPE_WRITE = 'nam.write';
export const SUPPORTED_SCOPES = [SCOPE_READ, SCOPE_WRITE] as const;

/**
 * Resolve the scopes to grant at consent. Both `nam.read` and `nam.write` are granted to every
 * connection the owner signs in (#1116): the sole owner always wanted write and enabled it every
 * time, so the per-connection consent checkbox was pure friction — it's retired. Write is still
 * never taken from the *client's* requested scope (a connector can't ask for more than the grant,
 * enforced on refresh by `constrainRefreshScopes`); the owner's authenticated sign-in is the
 * authority, and it now grants the full capability by default. A client may still *narrow* itself to
 * read-only on refresh, and the write tools stay legible in that case (they refuse with a clear
 * message rather than vanishing) — see `registerWrite` in server.ts.
 */
export function resolveGrantedScopes(): string[] {
  return [SCOPE_READ, SCOPE_WRITE];
}

/**
 * Constrain the scopes requested on a token refresh to the originally-granted set — a refresh may
 * narrow but MUST NOT widen (#1050: a `nam.read` token could otherwise ask for `nam.write`). Throws
 * `invalid_scope` (rendered by the SDK token handler) if the client requests anything outside the
 * grant; an empty/absent request keeps the full grant.
 */
export function constrainRefreshScopes(requested: string[] | undefined, granted: string[]): string[] {
  if (!requested?.length) return granted;
  const beyond = requested.filter((s) => !granted.includes(s));
  if (beyond.length) {
    throw new InvalidScopeError(`Requested scope(s) exceed the grant: ${beyond.join(' ')}`);
  }
  return requested;
}
