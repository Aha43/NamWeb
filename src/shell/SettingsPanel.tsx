import { useCallback, useEffect, useState } from 'react';
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

  const setWidth = useCallback((px: number) => {
    const clamped = clampWidth(px);
    setWidthState(clamped);
    try {
      localStorage.setItem(WIDTH_KEY, String(clamped));
    } catch {
      // best-effort persistence
    }
  }, []);

  // Escape closes — but not while typing in a field (native semantics) and not when a dialog is
  // stacked above (its own Escape handling owns the key, checked via data-state, not
  // defaultPrevented: some library layer preventDefaults Escape even with nothing open).
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (isTypingTarget(e.target)) return;
      if (isModalOpen()) return;
      onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Drag the divider: the panel grows as the pointer moves left (its left edge is being dragged).
  const onResizeStart = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      const startX = event.clientX;
      const startWidth = width;
      const onMove = (e: PointerEvent) => setWidth(startWidth + (startX - e.clientX));
      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      };
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
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
        className="flex shrink-0 flex-col overflow-y-auto px-4 py-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">{t('nav.settings')}</h2>
          <Button variant="ghost" size="icon" aria-label={t('settingsPanel.close')} onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <AccountSettingsTabs tab={tab} onTabChange={setTab} />
      </aside>
    </>
  );
}
