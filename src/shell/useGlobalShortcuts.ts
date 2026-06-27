import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCapture } from '@/capture/capture-context';

/** The `g`-then-letter chord destinations (Gmail/Linear-style). Mnemonics where they fit. */
const GO_TO: Record<string, string> = {
  i: '/inbox',
  n: '/next',
  b: '/backlog',
  d: '/due',
  k: '/blocked',
  p: '/projects',
  o: '/goals',
  t: '/tags',
  e: '/done',
  f: '/focus',
};

/** How long a pending `g` waits for its second key before it's forgotten. */
const CHORD_WINDOW_MS = 1500;

/** The id on the toolbar search input, so `/` can focus it from anywhere. */
export const TOOLBAR_SEARCH_ID = 'toolbar-search';

export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return (
    el.tagName === 'INPUT' ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'SELECT' ||
    el.isContentEditable
  );
}

/**
 * App-wide keyboard shortcuts (power users, physical keyboard). Mounted once inside the router so a
 * single `window` listener owns global keys:
 *   - `c` → open Quick capture
 *   - `/` → focus the toolbar search (falls back to navigating to Search if the box isn't mounted)
 *   - `g` then a letter → jump between views (see GO_TO)
 *   - `?` → open Help
 *
 * Never fires while typing in an input/textarea/select/contentEditable, and ignores Ctrl/Cmd/Alt
 * combos so browser and OS shortcuts are left alone.
 */
export function useGlobalShortcuts(): void {
  const navigate = useNavigate();
  const { openCapture } = useCapture();
  const pendingG = useRef(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const clearChord = () => {
      pendingG.current = false;
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    };

    function onKeyDown(event: KeyboardEvent) {
      // Leave browser/OS combos (Cmd+K, Ctrl+F, …) and IME composition alone.
      if (event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
      if (isTypingTarget(event.target)) return;

      // Second key of a `g` chord: route, then reset (always consume the pending state).
      if (pendingG.current) {
        const dest = GO_TO[event.key.toLowerCase()];
        clearChord();
        if (dest) {
          event.preventDefault();
          navigate(dest);
        }
        return;
      }

      if (event.key === 'g') {
        pendingG.current = true;
        timer.current = window.setTimeout(clearChord, CHORD_WINDOW_MS);
        return;
      }

      switch (event.key) {
        case 'c':
          event.preventDefault();
          openCapture();
          break;
        case '/': {
          event.preventDefault();
          const search = document.getElementById(TOOLBAR_SEARCH_ID) as HTMLInputElement | null;
          if (search) {
            search.focus();
            search.select();
          } else {
            navigate('/search');
          }
          break;
        }
        case '?':
          event.preventDefault();
          navigate('/help');
          break;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearChord();
    };
  }, [navigate, openCapture]);
}
