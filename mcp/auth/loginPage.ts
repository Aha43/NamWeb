// Minimal Supabase login page shown during the OAuth authorize step (P1).
//
// Local-grade only: unstyled, no CSRF token, posts credentials to /nam/login over
// the same origin. Hardening (CSRF, branding, rate-limit) rides along with P4
// hosting; for a local + tunnel prototype this is deliberately small.

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

  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Sign in to Nam</title></head>
<body style="font-family:system-ui,sans-serif;max-width:22rem;margin:4rem auto;padding:0 1rem">
  <h1 style="font-size:1.25rem">Connect to Nam</h1>
  <p style="color:#555">Sign in with your Nam (Supabase) account to let this assistant read your workspace.</p>
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
