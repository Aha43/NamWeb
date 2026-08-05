// OAuth scopes for the Nam MCP connector. Two granted capabilities so the consent
// is honest: read access to the workspace, and write access (the P2 mutation tools).
// `nam.read` is the baseline every token carries (write implies read); the resource
// endpoint requires it, and the write tools additionally require `nam.write`.

import { InvalidScopeError } from '@modelcontextprotocol/sdk/server/auth/errors.js';

export const SCOPE_READ = 'nam.read';
export const SCOPE_WRITE = 'nam.write';
export const SUPPORTED_SCOPES = [SCOPE_READ, SCOPE_WRITE] as const;

/**
 * Resolve which scopes to grant at consent. No scope requested → the connector's natural full set
 * (read + write; the user consents by logging in on our page). Otherwise: keep the supported subset,
 * and always include the `nam.read` baseline. A request naming ONLY unsupported scopes is narrowed to
 * read — never broadened up to write (#1050: the old fallback returned the full set here).
 */
export function resolveGrantedScopes(requested: string[]): string[] {
  if (requested.length === 0) return [...SUPPORTED_SCOPES];
  const supported: readonly string[] = SUPPORTED_SCOPES;
  const filtered = requested.filter((s) => supported.includes(s));
  const base = filtered.length ? filtered : [SCOPE_READ];
  return base.includes(SCOPE_READ) ? base : [SCOPE_READ, ...base];
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
