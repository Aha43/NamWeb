// "Export my data" — gather the signed-in user's data (their workspace rows) into
// a portable JSON bundle and download it. Satisfies the GDPR access/portability
// rights (and the delete flow nudges this first). A workspace is already a JSON
// document, so this is essentially "hand the user their rows."

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ExportedWorkspace {
  name: string;
  version: number;
  document: unknown;
  created_at: string;
  updated_at: string;
}

export interface ExportBundle {
  exportedAt: string;
  user: { id: string; email: string | null };
  workspaces: ExportedWorkspace[];
}

/** Collect all of the signed-in user's workspace rows (RLS-scoped) into a bundle. */
export async function buildUserExport(client: SupabaseClient): Promise<ExportBundle> {
  const { data: auth } = await client.auth.getUser();
  const user = auth.user;
  if (!user) throw new Error('Not signed in.');

  const { data, error } = await client
    .from('workspaces')
    .select('name, version, document, created_at, updated_at')
    .eq('owner_user_id', user.id)
    .order('name');
  if (error) throw new Error(error.message);

  return {
    exportedAt: new Date().toISOString(),
    user: { id: user.id, email: user.email ?? null },
    workspaces: (data ?? []) as ExportedWorkspace[],
  };
}

/** Trigger a browser download of the bundle as pretty-printed JSON. */
export function downloadJson(
  bundle: ExportBundle,
  filename = `nam-export-${bundle.exportedAt.slice(0, 10)}.json`,
): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
