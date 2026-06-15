import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rateLimit';

describe('createRateLimiter', () => {
  it('allows up to max then blocks within the window', () => {
    const rl = createRateLimiter({ windowMs: 1000, max: 3 });
    expect(rl.allow('ip', 0)).toBe(true);
    expect(rl.allow('ip', 0)).toBe(true);
    expect(rl.allow('ip', 0)).toBe(true);
    expect(rl.allow('ip', 0)).toBe(false); // 4th in-window
  });

  it('tracks keys independently', () => {
    const rl = createRateLimiter({ windowMs: 1000, max: 1 });
    expect(rl.allow('a', 0)).toBe(true);
    expect(rl.allow('b', 0)).toBe(true);
    expect(rl.allow('a', 0)).toBe(false);
  });

  it('frees budget once the window elapses', () => {
    const rl = createRateLimiter({ windowMs: 1000, max: 1 });
    expect(rl.allow('ip', 0)).toBe(true);
    expect(rl.allow('ip', 500)).toBe(false); // still inside the window
    expect(rl.allow('ip', 1001)).toBe(true); // window passed
  });
});
