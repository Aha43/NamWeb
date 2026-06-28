// Resolved deployment environment. `VITE_ENV` (set per Cloudflare environment) wins;
// otherwise a local `npm run dev` is 'development' and a prod build is 'production'.
// Extensible to 'staging' when that environment lands.
export type AppEnv = 'production' | 'staging' | 'development';

export const APP_ENV: AppEnv =
  (import.meta.env.VITE_ENV as AppEnv | undefined) ??
  (import.meta.env.DEV ? 'development' : 'production');

export const isProduction = APP_ENV === 'production';

// Release version (from package.json) and the build's commit SHA, baked in at build time by
// vite.config.ts. BUILD_SHA is empty for a local dev build. See #464.
export const APP_VERSION: string = __APP_VERSION__;
export const BUILD_SHA: string = __BUILD_SHA__;
