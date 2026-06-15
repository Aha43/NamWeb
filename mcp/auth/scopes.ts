// OAuth scopes for the Nam MCP connector. Two granted capabilities so the consent
// is honest: read access to the workspace, and write access (the P2 mutation tools).
// The write tools are gated on `nam.write`, so a token granted only `nam.read`
// genuinely cannot modify the workspace — the scope is enforced, not cosmetic.

export const SCOPE_READ = 'nam.read';
export const SCOPE_WRITE = 'nam.write';
export const SUPPORTED_SCOPES = [SCOPE_READ, SCOPE_WRITE] as const;

/**
 * Resolve which scopes to grant at consent: the client's requested scopes
 * intersected with what we support, or — when the client requested none — the
 * full supported set (the connector is read+write by nature). Unknown scopes drop.
 */
export function resolveGrantedScopes(requested: string[]): string[] {
  const supported: readonly string[] = SUPPORTED_SCOPES;
  const filtered = requested.filter((s) => supported.includes(s));
  return filtered.length ? filtered : [...SUPPORTED_SCOPES];
}
