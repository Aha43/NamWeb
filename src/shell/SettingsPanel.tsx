import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AccountSettingsTabs, type SettingsTab } from '@/routes/AccountPage';
import { isModalOpen, isTypingTarget } from './useGlobalShortcuts';

export const SETTINGS_PANEL_DEFAULT_WIDTH = 380;
export const SETTINGS_PANEL_MIN_WIDTH = 300;
export const SETTINGS_PANEL_MAX_WIDTH = 640;

const WIDTH_KEY = 'namweb.settings-panel.width';

const clampWidth = (px: number) =>
  Math.min(SETTINGS_PANEL_MAX_WIDTH, Math.max(SETTINGS_PANEL_MIN_WIDTH, Math.round(px)));

function readWidth(): number {
  try {
    const stored = Number(localStorage.getItem(WIDTH_KEY));
    if (Number.isFinite(stored) && stored > 0) return clampWidth(stored);
  } catch {
    // localStorage unavailable — fall back to the default.
  }
  return SETTINGS_PANEL_DEFAULT_WIDTH;
}

/**
 * The right **settings panel** (#599): Account/Preferences beside the live workspace instead of
 * replacing it — you watch a preference (language, dense mode, date format…) take effect as you
 * flip it. Opened from the AccountMenu (desktop); closed via the ✕ or Escape; resizable by its
 * left edge (width persisted, mirroring the left sidebar). The full `/account` page remains for
 * phones and direct links.
 */
export function SettingsPanel({ initialTab, onClose }: { initialTab: SettingsTab; onClose: () => void }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [width, setWidthState] = useState<number>(readWidth);

  // Picking the other AccountMenu item while the panel is already open switches tabs (#608) —
  // the panel stays mounted, so mount-time state alone would ignore the click.
  useEffect(() => setTab(initialTab), [initialTab]);

  const setWidth = useCallback((px: number) => {
    const clamped = clampWidth(px);
    setWidthState(clamped);
    try {
      localStorage.setItem(WIDTH_KEY, String(clamped));
    } catch {
      // best-effort persistence
    }
  }, []);

  // Escape closes — but not while typing in a field (native semantics) and not when any Radix
  // layer (dialog, dropdown menu, popover) is open: that layer owns the key. Listen in the
  // CAPTURE phase so the check runs before Radix dismisses the layer — by the bubble phase the
  // menu is already gone and the panel would close along with it (#608). Checked via data-state,
  // not defaultPrevented: some library layer preventDefaults Escape even with nothing open.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (isTypingTarget(e.target)) return;
      if (isModalOpen()) return;
      if (document.querySelector('[data-state="open"]:is([role="menu"],[role="listbox"],[data-radix-popper-content-wrapper])')) return;
      onClose();
    }
    document.addEventListener('keydown', onKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [onClose]);

  // Drag the divider: the panel grows as the pointer moves left (its left edge is being dragged).
  // The teardown lives in a ref so a mid-drag unmount (Escape closes the panel while the button is
  // still down) can't leak the document listeners and keep persisting widths (#608).
  const dragCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => dragCleanupRef.current?.(), []);
  const onResizeStart = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = width;
      const onMove = (e: PointerEvent) => setWidth(startWidth + (startX - e.clientX));
      const cleanup = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', cleanup);
        document.removeEventListener('pointercancel', cleanup);
        dragCleanupRef.current = null;
      };
      dragCleanupRef.current = cleanup;
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', cleanup);
      document.addEventListener('pointercancel', cleanup);
    },
    [width, setWidth],
  );

  const onResizeKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'ArrowLeft') setWidth(width + 16);
      else if (event.key === 'ArrowRight') setWidth(width - 16);
    },
    [width, setWidth],
  );

  return (
    <>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t('settingsPanel.resize')}
        aria-valuenow={width}
        aria-valuemin={SETTINGS_PANEL_MIN_WIDTH}
        aria-valuemax={SETTINGS_PANEL_MAX_WIDTH}
        tabIndex={0}
        onPointerDown={onResizeStart}
        onKeyDown={onResizeKeyDown}
        onDoubleClick={() => setWidth(SETTINGS_PANEL_DEFAULT_WIDTH)}
        className="w-1 shrink-0 cursor-col-resize bg-border transition-colors hover:bg-ring focus-visible:bg-ring focus-visible:outline-hidden"
      />
      <aside
        aria-label={t('nav.settings')}
        style={{ width }}
        className="flex shrink-0 flex-col overflow-hidden px-4 py-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">{t('nav.settings')}</h2>
          <Button variant="ghost" size="icon" aria-label={t('settingsPanel.close')} onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        {/* Only the tab body scrolls (#615): the Settings header (with the ✕) and the tab strip
            stay put however long the tab content gets. */}
        <AccountSettingsTabs tab={tab} onTabChange={setTab} bodyClassName="min-h-0 flex-1 overflow-y-auto" />
      </aside>
    </>
  );
}
