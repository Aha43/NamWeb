// Supabase login / consent page shown during the OAuth authorize step.
//
// The copy is honest about what is being granted: it reflects the resolved scopes
// (read vs read+write), so a user signing in knows the connector can modify their
// workspace, not just read it (P4b consent fix). Full hardening — CSRF token,
// rate-limit, branding — still rides along with the P4b hardened-page work.

import { resolveGrantedScopes, SCOPE_WRITE } from './scopes';

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** The OAuth params we must carry through the login POST to complete the redirect. */
export interface LoginPageParams {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state?: string;
  scope?: string;
  error?: string;
}

export function renderLoginPage(p: LoginPageParams): string {
  const hidden = [
    ['client_id', p.clientId],
    ['redirect_uri', p.redirectUri],
    ['code_challenge', p.codeChallenge],
    ['state', p.state ?? ''],
    ['scope', p.scope ?? ''],
  ]
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${esc(v)}" />`)
    .join('\n      ');

  const error = p.error
    ? `<p style="color:#b00">${esc(p.error)}</p>`
    : '';

  // Honest consent: describe exactly what the granted scopes allow.
  const granted = resolveGrantedScopes(p.scope ? p.scope.split(' ').filter(Boolean) : []);
  const canWrite = granted.includes(SCOPE_WRITE);
  const access = canWrite
    ? 'read <strong>and modify</strong> your workspace — it can view your projects, inbox, and actions, and create, edit, and delete them on your behalf.'
    : 'read your workspace — it can view your projects, inbox, and actions, but not change them.';

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Sign in to Nam</title></head>
<body style="font-family:system-ui,sans-serif;max-width:22rem;margin:4rem auto;padding:0 1rem">
  <h1 style="font-size:1.25rem">Connect to Nam</h1>
  <p style="color:#555">Sign in with your Nam (Supabase) account to let this assistant ${access}</p>
  ${error}
  <form method="post" action="/nam/login">
      ${hidden}
    <label style="display:block;margin:.75rem 0 .25rem">Email</label>
    <input name="email" type="email" autocomplete="username" required style="width:100%;padding:.5rem" />
    <label style="display:block;margin:.75rem 0 .25rem">Password</label>
    <input name="password" type="password" autocomplete="current-password" required style="width:100%;padding:.5rem" />
    <button type="submit" style="margin-top:1rem;padding:.5rem 1rem">Sign in</button>
  </form>
</body>
</html>`;
}

/** Step 2: pick which workspace to connect (shown only when the user has several). */
export function renderWorkspacePicker(p: { pendingId: string; workspaces: string[] }): string {
  const options = p.workspaces
    .map(
      (name, i) =>
        `<label style="display:block;margin:.4rem 0"><input type="radio" name="workspace" value="${esc(name)}"${i === 0 ? ' checked' : ''} /> ${esc(name)}</label>`,
    )
    .join('\n      ');

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Choose a workspace</title></head>
<body style="font-family:system-ui,sans-serif;max-width:22rem;margin:4rem auto;padding:0 1rem">
  <h1 style="font-size:1.25rem">Choose a workspace</h1>
  <p style="color:#555">This connector will act on the workspace you pick. To use another later, reconnect.</p>
  <form method="post" action="/nam/select-workspace">
    <input type="hidden" name="pending_id" value="${esc(p.pendingId)}" />
      ${options}
    <button type="submit" style="margin-top:1rem;padding:.5rem 1rem">Connect</button>
  </form>
</body>
</html>`;
}

/** Shown when an authenticated user has no workspace rows yet. */
export function renderNoWorkspacePage(): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>No workspace</title></head>
<body style="font-family:system-ui,sans-serif;max-width:22rem;margin:4rem auto;padding:0 1rem">
  <h1 style="font-size:1.25rem">No workspace yet</h1>
  <p style="color:#555">You don't have a workspace to connect. Open the Nam app and create one first, then reconnect.</p>
</body>
</html>`;
}
