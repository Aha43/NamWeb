// Postgres connection for the MCP-owned OAuth store (P4a). A single lazy pool,
// built from NAM_MCP_DATABASE_URL — a server-only secret pointing at the same
// Supabase Postgres the workspace data lives in, but used here for the AS's own
// bookkeeping (the `mcp` schema), independent of the user-JWT/RLS data plane.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

let pool: pg.Pool | undefined;

/** The shared pool. Throws if NAM_MCP_DATABASE_URL is unset (caller gates on it). */
export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.NAM_MCP_DATABASE_URL;
    if (!connectionString) {
      throw new Error('NAM_MCP_DATABASE_URL is not set — cannot use the persistent OAuth store');
    }
    pool = new pg.Pool({ connectionString });
  }
  return pool;
}

const here = dirname(fileURLToPath(import.meta.url));

/** Create the `mcp` schema + tables if absent. Idempotent; run on startup. */
export async function ensureSchema(p: pg.Pool = getPool()): Promise<void> {
  const sql = readFileSync(join(here, 'schema.sql'), 'utf8');
  await p.query(sql);
}
