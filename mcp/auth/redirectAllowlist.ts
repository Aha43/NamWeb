// Production redirect-URI allowlist for the OAuth server (#1052). Dynamic Client Registration is
// open (that's how Claude/ChatGPT self-register), so the phishing control is on WHERE an auth code
// may be sent: only redirect URIs whose ORIGIN is on the allowlist are accepted — enforced both at
// registration and again at login. An attacker can't register a client that redirects the code to
// their own domain.
//
// Configure `NAM_MCP_ALLOWED_REDIRECT_ORIGINS` with the connector callback origins you use, e.g.
// "https://claude.ai,https://chatgpt.com". Fail-closed: in a deployment (NODE_ENV=production or an
// https issuer) with the list unset, ALL redirects are refused until it's configured — so a fresh
// deploy can't accidentally accept arbitrary redirects.

function looksLikeDeployment(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV === 'production' || (env.NAM_MCP_ISSUER_URL ?? '').startsWith('https://');
}

export interface RedirectAllowlist {
  /** Allowed redirect-URI origins (scheme + host + port), exact match. */
  origins: string[];
  /** When false (local/dev, no list configured) any redirect is allowed for tunnel/Inspector testing. */
  enforce: boolean;
}

export function loadRedirectAllowlist(env: NodeJS.ProcessEnv = process.env): RedirectAllowlist {
  const origins = (env.NAM_MCP_ALLOWED_REDIRECT_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return { origins, enforce: origins.length > 0 || looksLikeDeployment(env) };
}

/** True if `uri`'s origin is permitted. Not enforcing (local/dev) → always true. Unparseable → false. */
export function isRedirectUriAllowed(uri: string, allowlist: RedirectAllowlist): boolean {
  if (!allowlist.enforce) return true;
  let origin: string;
  try {
    origin = new URL(uri).origin;
  } catch {
    return false;
  }
  return allowlist.origins.includes(origin);
}
