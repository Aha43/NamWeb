// OAuth scopes for the Nam MCP connector. Two granted capabilities so the consent
// is honest: read access to the workspace, and write access (the P2 mutation tools).
// `nam.read` is the baseline every token carries (write implies read); the resource
// endpoint requires it, and the write tools additionally require `nam.write`.

import { InvalidScopeError } from '@modelcontextprotocol/sdk/server/auth/errors.js';

export const SCOPE_READ = 'nam.read';
export const SCOPE_WRITE = 'nam.write';
export const SUPPORTED_SCOPES = [SCOPE_READ, SCOPE_WRITE] as const;

/**
 * Resolve the scopes to grant at consent (#1069 opt-in write). `nam.read` is always granted — the
 * baseline every connection carries. `nam.write` is granted ONLY when the resource owner ticks the
 * write-consent checkbox on the sign-in page (`allowWrite`), NEVER from the client's requested scope
 * alone: a client can't escalate itself to write (#1050), and read-only stays the safe default. The
 * client's requested `scope` is advisory — the owner's consent is the authority for write.
 */
export function resolveGrantedScopes(allowWrite: boolean): string[] {
  return allowWrite ? [SCOPE_READ, SCOPE_WRITE] : [SCOPE_READ];
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
