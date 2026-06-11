// Which remote workspace row the client syncs against, resolved at runtime so a
// login toggle can switch it (e.g. the `dev` row NamDesktop dev-mode writes).
// Precedence: an explicit localStorage choice, else VITE_WORKSPACE_NAME, else
// `default` (matching NamDesktop normal-mode / CloudSyncSettings.WORKSPACE_DEFAULT).

const STORAGE_KEY = 'namweb.workspaceName';

/** The row NamDesktop dev-mode syncs to (CloudSyncSettings.WORKSPACE_DEV). */
export const DEV_WORKSPACE = 'dev';

/** The build-time default — the production / normal-mode row. */
export const DEFAULT_WORKSPACE = import.meta.env.VITE_WORKSPACE_NAME?.trim() || 'default';

export function getWorkspaceName(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)?.trim();
    if (stored) return stored;
  } catch {
    // localStorage may be unavailable (private mode, SSR) — fall back to the default.
  }
  return DEFAULT_WORKSPACE;
}

/** Persist the chosen workspace, or pass `null` to clear back to the default. */
export function setWorkspaceName(name: string | null): void {
  try {
    if (name) localStorage.setItem(STORAGE_KEY, name);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best-effort — a failed write just means the default is used next load.
  }
}

export function isDevWorkspaceSelected(): boolean {
  return getWorkspaceName() === DEV_WORKSPACE;
}
