// At-rest protection for the persistent OAuth store (#1053). Two primitives:
//
// - hashToken: bearer secrets (access/refresh tokens, auth codes, pending-login ids) are stored by
//   their SHA-256, never in the clear — a database dump can't be replayed as a live credential.
// - encryptJson/decryptJson: the Supabase session (which carries the user's Supabase refresh token —
//   effectively account access) is envelope-encrypted with an app key (AES-256-GCM) before it's
//   written, so a dump doesn't hand over sessions.
//
// The InMemoryAuthStore does NOT use these — it's ephemeral process memory, not an at-rest surface.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/** Deterministic SHA-256 (hex) of a bearer secret, for storage/lookup by hash. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Load the 32-byte AES key from NAM_MCP_ENCRYPTION_KEY (64 hex chars, or base64). Throws if absent
 *  or malformed — the Postgres store requires it (fail-closed: no plaintext sessions at rest). */
export function loadEncryptionKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const raw = env.NAM_MCP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'NAM_MCP_ENCRYPTION_KEY is required with the Postgres store — a 32-byte key (64 hex chars or ' +
        'base64) for encrypting Supabase sessions at rest. Generate one: `openssl rand -hex 32`.',
    );
  }
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('NAM_MCP_ENCRYPTION_KEY must decode to 32 bytes (64 hex chars, or base64).');
  }
  return key;
}

/** AES-256-GCM encrypt a JSON value → base64(iv[12] | authTag[16] | ciphertext). Fresh IV each call. */
export function encryptJson(value: unknown, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(value), 'utf8')), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
}

/** Inverse of {@link encryptJson}. Throws (GCM auth) if the blob was tampered with or the key is wrong. */
export function decryptJson<T = unknown>(blob: string, key: Buffer): T {
  const buf = Buffer.from(blob, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return JSON.parse(pt.toString('utf8')) as T;
}
