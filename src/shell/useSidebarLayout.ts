import { useCallback, useState } from 'react';

export const SIDEBAR_DEFAULT_WIDTH = 240;
export const SIDEBAR_MIN_WIDTH = 180;
export const SIDEBAR_MAX_WIDTH = 480;

const WIDTH_KEY = 'namweb.sidebar.width';
const COLLAPSED_KEY = 'namweb.sidebar.collapsed';

const clampWidth = (px: number) =>
  Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(px)));

function readWidth(): number {
  try {
    const stored = Number(localStorage.getItem(WIDTH_KEY));
    if (Number.isFinite(stored) && stored > 0) return clampWidth(stored);
  } catch {
    // localStorage unavailable — fall back to the default.
  }
  return SIDEBAR_DEFAULT_WIDTH;
}

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

export interface SidebarLayout {
  width: number;
  collapsed: boolean;
  setWidth: (px: number) => void;
  toggleCollapsed: () => void;
}

/** Desktop view-list sidebar layout (width + collapsed), persisted to localStorage.
 *  Mirrors the per-feature localStorage hooks (`useViewMode`, `useCollapsedColumns`). */
export function useSidebarLayout(): SidebarLayout {
  const [width, setWidthState] = useState<number>(readWidth);
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed);

  const setWidth = useCallback((px: number) => {
    const next = clampWidth(px);
    setWidthState(next);
    try {
      localStorage.setItem(WIDTH_KEY, String(next));
    } catch {
      // best-effort persistence
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_KEY, String(next));
      } catch {
        // best-effort persistence
      }
      return next;
    });
  }, []);

  return { width, collapsed, setWidth, toggleCollapsed };
}
