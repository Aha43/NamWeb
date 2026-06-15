// In-memory sliding-window rate limiter for the sign-in POST, to blunt credential
// stuffing once the server is on a public URL. Keyed by client IP; per-process
// (fine for a single instance — a multi-instance deploy would move this to a shared
// store). Needs `app.set('trust proxy', …)` so req.ip is the real client.

import type { NextFunction, Request, Response } from 'express';

export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

/** Returns true if `key` is within budget (and records the hit); false if over. */
export function createRateLimiter({ windowMs, max }: RateLimitOptions) {
  const hits = new Map<string, number[]>();

  function allow(key: string, now = Date.now()): boolean {
    const fresh = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (fresh.length >= max) {
      hits.set(key, fresh); // keep the window accurate without adding a hit
      return false;
    }
    fresh.push(now);
    hits.set(key, fresh);
    return true;
  }

  /** Express middleware → 429 when the IP exceeds the budget. */
  function middleware(req: Request, res: Response, next: NextFunction): void {
    const key = req.ip ?? 'unknown';
    if (allow(key)) {
      next();
      return;
    }
    res.status(429).send('Too many sign-in attempts. Please wait a minute and try again.');
  }

  return { allow, middleware };
}
