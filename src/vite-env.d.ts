/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  /** Workspace row to sync against — matches NamDesktop (`default`, or `dev` in dev-mode). */
  readonly VITE_WORKSPACE_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Injected at build time by vite.config.ts `define` (see #464).
/** App release version, from package.json. */
declare const __APP_VERSION__: string;
/** Build commit SHA (Cloudflare CF_PAGES_COMMIT_SHA); empty string for a local dev build. */
declare const __BUILD_SHA__: string;
