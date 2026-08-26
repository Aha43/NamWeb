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

import { readFileSync, readdirSync } from 'node:fs';
import { signedInClient, workspaceName } from '../mcp/server';
import { pull, push } from '../src/sync/workspaceClient';
import { stampResourceIds } from '../src/domain/resourceMigration';
import { newId } from '../src/lib/local';

/**
 * On Fly, `fly ssh console` starts a bare shell — it does NOT inherit the app's injected secrets
 * (those live on the running app process, not the ssh session). Backfill any missing vars from the
 * environ of whichever process HAS them (found by scanning /proc — the ssh session runs as root, so
 * it can read the app process's environ). No-op locally (vars already set) or off a /proc system.
 */
function backfillEnvFromRunningApp(): void {
  if (process.env.NAM_MCP_EMAIL) return; // already have it (local run via .env)
  let pids: string[];
  try {
    pids = readdirSync('/proc').filter((p) => /^\d+$/.test(p));
  } catch {
    return; // not on Fly / no /proc — leave env as-is; requireEnv reports the real missing var.
  }
  for (const pid of pids) {
    let raw: string;
    try {
      raw = readFileSync(`/proc/${pid}/environ`, 'utf8');
    } catch {
      continue; // process gone or not readable
    }
    if (!raw.includes('NAM_MCP_EMAIL=')) continue; // not the app process
    for (const pair of raw.split('\0')) {
      const eq = pair.indexOf('=');
      if (eq <= 0) continue;
      const key = pair.slice(0, eq);
      if (process.env[key] === undefined) process.env[key] = pair.slice(eq + 1);
    }
    return; // found + loaded the app's env
  }
}

async function main(): Promise<void> {
  backfillEnvFromRunningApp(); // Fly ssh has a bare env — pull the secrets off the running app process
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
