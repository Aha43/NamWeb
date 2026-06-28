import { APP_VERSION, BUILD_SHA } from './env';

// The product's user-facing name. Spelled out where there's room (e.g. the
// sign-in screen); the repo/package keep the short internal name "NamWeb".
// Matches NamDesktop's wordmark.
export const APP_NAME = 'Next Action Master';

// Compact brand used next to the logo in the app chrome, where the full name
// is too long. Pair it with the `brandTooltip()` label so the full name (plus
// version + build) stays on hover.
export const APP_SHORT_NAME = 'NAM';

// Wordmark hover label: the full name plus the release version and build — the short commit SHA, or
// "dev" for a local build. Reachable while signed in without digging to Help; hover-only, so it adds
// no visual clutter. See #469.
export function brandTooltip(): string {
  const build = BUILD_SHA ? BUILD_SHA.slice(0, 7) : 'dev';
  return `${APP_NAME} · v${APP_VERSION} · ${build}`;
}
