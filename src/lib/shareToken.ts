// Share tokens (#759): the capability — the URL's secrecy IS the access control. 22 chars of
// base62 ≈ 131 bits from the platform CSPRNG. Rejection sampling keeps the distribution
// uniform (no modulo bias).

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export const SHARE_TOKEN_LENGTH = 22;

export function newShareToken(): string {
  const out: string[] = [];
  const buf = new Uint8Array(64);
  while (out.length < SHARE_TOKEN_LENGTH) {
    crypto.getRandomValues(buf);
    for (const byte of buf) {
      // 0..247 maps uniformly onto the 62-char alphabet (248 = 62 * 4); reject 248..255.
      if (byte >= 248) continue;
      out.push(ALPHABET[byte % 62]);
      if (out.length === SHARE_TOKEN_LENGTH) break;
    }
  }
  return out.join('');
}
