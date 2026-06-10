import '@testing-library/jest-dom';

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
