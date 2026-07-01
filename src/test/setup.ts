import '@testing-library/jest-dom';
// Initialize i18next (English active) so components using useTranslation render translated copy in
// tests, via the global instance — no per-test provider needed. Test-locale = en (#400).
import '@/lib/i18n';

// Radix pointer-based primitives (dropdown menu) need these in jsdom.
if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};

// jsdom has no ResizeObserver; TruncatedTitle observes its element to re-measure overflow.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom has no matchMedia; default to phone (matches: false). Tests that exercise
// the desktop shell override window.matchMedia before rendering.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
