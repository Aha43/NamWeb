// CSRF protection for the consent forms (double-submit cookie). A random token is
// set as an httpOnly cookie at render and echoed in a hidden form field; on POST
// the two must match. A cross-site forgery can neither read our cookie (same-origin
// policy) nor set the matching field, so it can't produce a valid pair. SameSite=Lax
// is a second, overlapping layer.

import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';

const COOKIE = 'nam_csrf';
const MAX_AGE_MS = 15 * 60 * 1000; // 15 min — time to complete the consent

/** Mint a CSRF token, set it as an httpOnly cookie, and return it to embed in the form. */
export function issueCsrf(res: Response): string {
  const token = randomBytes(24).toString('base64url');
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: res.req?.secure === true, // set over https (tunnel/deploy); off for local http
    maxAge: MAX_AGE_MS,
    path: '/',
  });
  return token;
}

/** Double-submit check: the form's `_csrf` must match the `nam_csrf` cookie. */
export function verifyCsrf(req: Request): boolean {
  const cookie = readCookie(req, COOKIE);
  const field = typeof req.body?._csrf === 'string' ? req.body._csrf : '';
  return !!cookie && !!field && safeEqual(cookie, field);
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers?.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
