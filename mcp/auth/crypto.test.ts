import { describe, expect, it } from 'vitest';
import { decryptJson, encryptJson, hashToken, loadEncryptionKey } from './crypto';

const KEY = Buffer.alloc(32, 9);

describe('hashToken (#1053)', () => {
  it('is deterministic and not the input', () => {
    expect(hashToken('secret')).toBe(hashToken('secret'));
    expect(hashToken('secret')).not.toBe('secret');
    expect(hashToken('a')).not.toBe(hashToken('b'));
    expect(hashToken('secret')).toMatch(/^[0-9a-f]{64}$/); // sha-256 hex
  });
});

describe('encryptJson / decryptJson (#1053)', () => {
  it('round-trips a value', () => {
    // A long, distinctive canary made of base64-safe chars: the "ciphertext doesn't leak the
    // plaintext" check must be meaningful (the token *could* appear in the base64 output if leaked)
    // yet impossible to satisfy by chance. A short substring like "at" appears in random base64 ~2%
    // of the time, which flaked CI (#1121-era); a 25-char marker never will.
    const canary = 'PlaintextLeakCanary123456';
    const value = { access_token: canary, refresh_token: 'rt', nested: [1, 2] };
    const blob = encryptJson(value, KEY);
    expect(typeof blob).toBe('string');
    expect(blob).not.toContain(canary); // ciphertext, not the plaintext
    expect(decryptJson(blob, KEY)).toEqual(value);
  });

  it('uses a fresh IV each call (ciphertexts differ)', () => {
    expect(encryptJson('x', KEY)).not.toBe(encryptJson('x', KEY));
  });

  it('fails to decrypt with the wrong key', () => {
    const blob = encryptJson({ a: 1 }, KEY);
    expect(() => decryptJson(blob, Buffer.alloc(32, 1))).toThrow();
  });

  it('fails to decrypt a tampered blob (GCM auth)', () => {
    const blob = Buffer.from(encryptJson({ a: 1 }, KEY), 'base64');
    blob[blob.length - 1] ^= 0xff; // flip a ciphertext bit
    expect(() => decryptJson(blob.toString('base64'), KEY)).toThrow();
  });
});

describe('loadEncryptionKey (#1053)', () => {
  it('accepts a 64-hex-char key', () => {
    expect(loadEncryptionKey({ NAM_MCP_ENCRYPTION_KEY: '00'.repeat(32) })).toHaveLength(32);
  });

  it('accepts a base64 32-byte key', () => {
    expect(loadEncryptionKey({ NAM_MCP_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString('base64') })).toHaveLength(32);
  });

  it('throws when missing or the wrong length', () => {
    expect(() => loadEncryptionKey({})).toThrow(/required/i);
    expect(() => loadEncryptionKey({ NAM_MCP_ENCRYPTION_KEY: 'tooshort' })).toThrow(/32 bytes/i);
  });
});
