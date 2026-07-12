import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ToastContext, type ToastOptions } from './toast-context';
import { isModalOpen, isTypingTarget } from '@/shell/useGlobalShortcuts';

// Mac shows ⌘; everyone else Ctrl. Best-effort platform sniff for the shortcut hint.
const IS_MAC = typeof navigator !== 'undefined' && /Mac|iP(hone|ad|od)/.test(navigator.platform);

interface ActiveToast extends ToastOptions {
  id: number;
}

/** Renders a small stack of bottom-centered toasts and provides `toast()` to the tree. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { t: translate } = useTranslation(); // aliased — `t` is the toast var in the render below
  const [toasts, setToasts] = useState<ActiveToast[]>([]);
  const nextId = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++;
      setToasts((list) => [...list, { ...options, id }]);
      const timer = setTimeout(() => dismiss(id), options.durationMs ?? 6000);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  // ⌘/Ctrl+Z fires the newest actionable toast (#744) — Undo without the mouse travel. Text
  // fields keep their own undo, and a modal owns the keys (toasts are aria-hidden under it).
  useEffect(() => {
    if (!toasts.some((t) => t.onAction)) return;
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'z') return;
      if (isTypingTarget(e.target) || isModalOpen()) return;
      const target = [...toasts].reverse().find((t) => t.onAction);
      if (!target) return;
      e.preventDefault();
      target.onAction?.();
      dismiss(target.id);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [toasts, dismiss]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {toasts.length > 0 && (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
          role="region"
          aria-label={translate('toast.notifications')}
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto flex max-w-md items-center gap-3 rounded-lg border border-border bg-popover px-4 py-2.5 text-sm text-popover-foreground shadow-md"
            >
              <span className="min-w-0 flex-1">{t.message}</span>
              {t.actionLabel && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  aria-keyshortcuts={IS_MAC ? 'Meta+Z' : 'Control+Z'}
                  onClick={() => {
                    t.onAction?.();
                    dismiss(t.id);
                  }}
                >
                  {t.actionLabel}
                  {/* aria-hidden: the hint must not leak into the accessible name ("UndoCtrl+Z"). */}
                  <kbd aria-hidden className="rounded border border-border bg-muted px-1 font-mono text-[10px] text-muted-foreground">
                    {IS_MAC ? '⌘Z' : 'Ctrl+Z'}
                  </kbd>
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
