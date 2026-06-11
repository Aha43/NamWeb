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
