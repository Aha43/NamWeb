// Branded Supabase login / consent pages for the OAuth authorize step.
//
// Honest consent copy (reflects the granted read vs read+write scopes), a CSRF
// token on every form (double-submit cookie — see ./csrf), and Nam branding +
// styling, so this is presentable as the trust surface for a public connector.

import { resolveGrantedScopes, SCOPE_WRITE } from './scopes';

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// The Nam brand mark (ported from src/components/brand/LogoMark); structural nodes
// follow `currentColor`, the signal node + check are fixed brand colours.
const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="none" width="40" height="40" aria-hidden="true">
  <g stroke="currentColor" stroke-width="11" stroke-linecap="round" opacity="0.42">
    <path d="M128 74 L84 182" /><path d="M128 74 L172 182" />
  </g>
  <g fill="none" stroke="#3FA463" stroke-width="7" stroke-linecap="round">
    <path d="M130.6 44.1 A30 30 0 0 1 157.5 68.8" opacity="0.55" />
    <path d="M131.7 32.2 A42 42 0 0 1 169.4 66.7" opacity="0.3" />
  </g>
  <circle cx="128" cy="74" r="18" fill="currentColor" />
  <circle cx="84" cy="182" r="18" fill="currentColor" />
  <circle cx="172" cy="182" r="27" fill="#3FA463" />
  <path d="M159 183 l9 9 l18 -21" fill="none" stroke="#FFFFFF" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" />
</svg>`;

const STYLE = `
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, sans-serif; margin: 0; min-height: 100vh;
    display: flex; align-items: center; justify-content: center; padding: 1.5rem;
    background: #f6f7f9; color: #1b1f24; }
  .card { width: 100%; max-width: 23rem; background: #fff; border: 1px solid #e3e6ea;
    border-radius: 14px; padding: 1.75rem; box-shadow: 0 1px 3px rgba(0,0,0,.06); }
  .brand { display: flex; align-items: center; gap: .6rem; color: #1b1f24; margin-bottom: 1rem; }
  .brand h1 { font-size: 1.15rem; font-weight: 600; margin: 0; letter-spacing: -.01em; }
  p.lead { color: #5a626c; font-size: .92rem; line-height: 1.5; margin: 0 0 1.25rem; }
  label { display: block; font-size: .8rem; font-weight: 500; margin: .85rem 0 .3rem; }
  input[type=email], input[type=password] { width: 100%; padding: .6rem .7rem; font-size: 1rem;
    border: 1px solid #cfd4da; border-radius: 8px; background: #fff; color: inherit; }
  input:focus { outline: none; border-color: #3FA463; box-shadow: 0 0 0 3px rgba(63,164,99,.15); }
  .choice { display: flex; align-items: center; gap: .55rem; padding: .55rem .65rem; margin: .35rem 0;
    border: 1px solid #cfd4da; border-radius: 8px; font-size: .95rem; cursor: pointer; }
  button { width: 100%; margin-top: 1.25rem; padding: .65rem 1rem; font-size: .95rem; font-weight: 600;
    color: #fff; background: #3FA463; border: 0; border-radius: 8px; cursor: pointer; }
  button:hover { background: #368a55; }
  .err { color: #c0392b; font-size: .85rem; margin: 0 0 .5rem; }
  @media (prefers-color-scheme: dark) {
    body { background: #0b0e14; color: #e6e9ee; }
    .card { background: #161b22; border-color: #2a313b; box-shadow: none; }
    .brand { color: #e6e9ee; } p.lead { color: #9aa3ad; }
    input[type=email], input[type=password] { background: #0e1117; border-color: #2a313b; }
    .choice { border-color: #2a313b; }
  }`;

/** Wrap page body in the shared branded card layout. */
function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title><style>${STYLE}</style></head>
<body>
  <main class="card">
    <div class="brand">${LOGO_SVG}<h1>Nam</h1></div>
${body}
  </main>
</body>
</html>`;
}

/** The OAuth params we must carry through the login POST to complete the redirect. */
export interface LoginPageParams {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state?: string;
  scope?: string;
  csrfToken: string;
  error?: string;
}

export function renderLoginPage(p: LoginPageParams): string {
  const hidden = [
    ['client_id', p.clientId],
    ['redirect_uri', p.redirectUri],
    ['code_challenge', p.codeChallenge],
    ['state', p.state ?? ''],
    ['scope', p.scope ?? ''],
    ['_csrf', p.csrfToken],
  ]
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${esc(v)}" />`)
    .join('\n      ');

  const error = p.error ? `<p class="err">${esc(p.error)}</p>` : '';

  // Honest consent: describe exactly what the granted scopes allow.
  const granted = resolveGrantedScopes(p.scope ? p.scope.split(' ').filter(Boolean) : []);
  const canWrite = granted.includes(SCOPE_WRITE);
  const access = canWrite
    ? 'read <strong>and modify</strong> your workspace — view your projects, inbox, and actions, and create, edit, and delete them on your behalf.'
    : 'read your workspace — view your projects, inbox, and actions, but not change them.';

  return page(
    'Sign in to Nam',
    `    <p class="lead">Sign in with your Nam account to let this assistant ${access}</p>
    ${error}
    <form method="post" action="/nam/login">
      ${hidden}
      <label>Email</label>
      <input name="email" type="email" autocomplete="username" required />
      <label>Password</label>
      <input name="password" type="password" autocomplete="current-password" required />
      <button type="submit">Sign in</button>
    </form>`,
  );
}

/** Step 2: pick which workspace to connect (shown only when the user has several). */
export function renderWorkspacePicker(p: {
  pendingId: string;
  workspaces: string[];
  csrfToken: string;
}): string {
  const options = p.workspaces
    .map(
      (name, i) =>
        `<label class="choice"><input type="radio" name="workspace" value="${esc(name)}"${i === 0 ? ' checked' : ''} /> ${esc(name)}</label>`,
    )
    .join('\n      ');

  return page(
    'Choose a workspace',
    `    <p class="lead">This connector will act on the workspace you pick. To use another later, reconnect.</p>
    <form method="post" action="/nam/select-workspace">
      <input type="hidden" name="pending_id" value="${esc(p.pendingId)}" />
      <input type="hidden" name="_csrf" value="${esc(p.csrfToken)}" />
      ${options}
      <button type="submit">Connect</button>
    </form>`,
  );
}

/** Shown when an authenticated user has no workspace rows yet. */
export function renderNoWorkspacePage(): string {
  return page(
    'No workspace',
    `    <p class="lead">You don't have a workspace to connect. Open the Nam app and create one first, then reconnect.</p>`,
  );
}
