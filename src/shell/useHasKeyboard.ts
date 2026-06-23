import { useEffect, useState } from 'react';

const FINE_POINTER = '(pointer: fine)'; // mouse/trackpad ⇒ a desktop-class device that almost always has a keyboard

/**
 * Whether the device likely has a physical keyboard — drives *capability* hints (e.g. showing
 * keyboard shortcuts), independently of the responsive layout breakpoint (`useIsDesktop`). A wide
 * touch tablet shouldn't be told about Space/Esc; a narrow laptop should. We infer from a fine
 * pointer, and upgrade permanently the instant a real key is pressed (proof of a keyboard, e.g. a
 * tablet with an attached one).
 */
export function useHasKeyboard(): boolean {
  const [hasKeyboard, setHasKeyboard] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(FINE_POINTER).matches,
  );

  useEffect(() => {
    const mql = window.matchMedia(FINE_POINTER);
    // Once true, stay true — a keyboard doesn't stop existing mid-session.
    const sync = () => setHasKeyboard((prev) => prev || mql.matches);
    mql.addEventListener('change', sync);
    sync();
    const onKey = () => setHasKeyboard(true);
    window.addEventListener('keydown', onKey);
    return () => {
      mql.removeEventListener('change', sync);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return hasKeyboard;
}
