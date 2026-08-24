// One-off migration (#1195): stamp a stable `id` onto every legacy (pre-id) resource in a workspace,
// so no resource needs array-index addressing anymore (closing the shifting-index trap for good).
//
// Reuses the MCP server's sign-in + workspace resolution, so it hits the SAME workspace the connector
// serves — driven by the env (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY / NAM_MCP_EMAIL /
// NAM_MCP_PASSWORD / VITE_WORKSPACE_NAME). Point the env at the workspace you mean to migrate.
//
//   DRY RUN (default): tsx --env-file=.env scripts/migrate-resource-ids.ts
//   APPLY:             APPLY=1 tsx --env-file=.env scripts/migrate-resource-ids.ts
//
// Idempotent + version-guarded: re-running after success stamps nothing; a concurrent write aborts it
// with nothing written (just re-run). See `make migrate-resource-ids`.

import { signedInClient, workspaceName } from '../mcp/server';
import { pull, push } from '../src/sync/workspaceClient';
import { stampResourceIds } from '../src/domain/resourceMigration';
import { newId } from '../src/lib/local';

async function main(): Promise<void> {
  const apply = process.env.APPLY === '1';
  const url = process.env.VITE_SUPABASE_URL ?? '(VITE_SUPABASE_URL unset)';

  const client = await signedInClient();
  const name = workspaceName();

  console.log('\nResource-id migration (#1195)');
  console.log(`  target    : ${url}`);
  console.log(`  workspace : "${name}"`);
  console.log(`  mode      : ${apply ? 'APPLY — will write' : 'DRY RUN — no write'}\n`);

  const pulled = await pull(client, name);
  if (pulled.kind === 'noRemote') {
    console.error(`✗ No workspace row named "${name}" for this user. Check VITE_WORKSPACE_NAME / creds.`);
    process.exit(1);
  }
  if (pulled.kind === 'error') {
    console.error(`✗ Pull failed: ${pulled.message}`);
    process.exit(1);
  }

  const { document, version } = pulled;
  const total = Object.values(document.nodes).reduce((sum, n) => sum + n.resources.length, 0);
  const count = stampResourceIds(document, newId); // mutates `document` in place

  console.log(`  resources : ${total} total, ${count} missing an id.`);

  if (count === 0) {
    console.log('\n✓ Nothing to migrate — every resource already has an id.\n');
    process.exit(0);
  }
  if (!apply) {
    console.log(`\nDry run only. Re-run with APPLY=1 to stamp ${count} resource id(s).\n`);
    process.exit(0);
  }

  const res = await push(client, name, document, version);
  if (res.kind === 'ok') {
    console.log(`\n✓ Stamped ${count} resource id(s). Workspace now at version ${res.version}.\n`);
    process.exit(0);
  }
  if (res.kind === 'conflict') {
    console.error('\n✗ Version conflict — another writer landed first. Nothing written; re-run when quiet.\n');
    process.exit(1);
  }
  console.error(`\n✗ Push failed: ${res.message}\n`);
  process.exit(1);
}

void main();
