// Resolved deployment environment. `VITE_ENV` (set per Cloudflare environment) wins;
// otherwise a local `npm run dev` is 'development' and a prod build is 'production'.
// Extensible to 'staging' when that environment lands.
export type AppEnv = 'production' | 'staging' | 'development';

export const APP_ENV: AppEnv =
  (import.meta.env.VITE_ENV as AppEnv | undefined) ??
  (import.meta.env.DEV ? 'development' : 'production');

export const isProduction = APP_ENV === 'production';
