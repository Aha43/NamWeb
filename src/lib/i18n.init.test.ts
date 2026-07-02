import { afterEach, describe, expect, it, vi } from 'vitest';

// #579 — the runtime must come up in the stored/detected language so the very first paint is
// already translated (previously it always initialized in English and switched post-mount).
describe('i18n init language (#579)', () => {
  afterEach(() => {
    try {
      localStorage.clear();
    } catch {
      // ignore
    }
    vi.resetModules();
  });

  it('initializes in the stored language, including <html lang>', async () => {
    localStorage.setItem('namweb.settings.language', 'nb');
    vi.resetModules();
    const mod = await import('@/lib/i18n');
    expect(mod.detectInitialLocale()).toBe('nb');
    expect(mod.default.language).toBe('nb');
    expect(document.documentElement.lang).toBe('nb');
  });

  it('falls back to browser detection when nothing is stored (en here)', async () => {
    vi.resetModules();
    const mod = await import('@/lib/i18n');
    expect(mod.detectInitialLocale()).toBe('en'); // jsdom reports en-US
    expect(mod.default.language).toBe('en');
  });

  it('ignores an invalid stored value', async () => {
    localStorage.setItem('namweb.settings.language', 'xx');
    vi.resetModules();
    const mod = await import('@/lib/i18n');
    expect(mod.detectInitialLocale()).toBe('en');
  });
});
