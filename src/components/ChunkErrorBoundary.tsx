import { Component, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { isChunkLoadError } from '@/lib/chunkError';
import { Button } from './ui/button';

const RELOAD_GUARD_KEY = 'nam:chunk-reload-at';
/** Don't reload again within this window — a genuinely-missing chunk (e.g. offline) must not loop. */
const RELOAD_WINDOW_MS = 10_000;

function safeSessionStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return window.sessionStorage;
  } catch {
    // Private-mode / disabled storage — no loop guard available, so we show the manual Reload
    // fallback instead of auto-reloading.
    return null;
  }
}

interface Props {
  children: ReactNode;
  /** Injectable for tests. */
  reload?: () => void;
  now?: () => number;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
}

interface State {
  failed: boolean;
}

/**
 * Turns a failed lazy-chunk load (or any render crash) under it into a recoverable screen instead
 * of a blank page. A chunk-load failure auto-reloads once (the fresh shell carries the new hashes),
 * guarded so a permanently-missing chunk shows a manual Reload button rather than looping. A
 * non-chunk render error skips the auto-reload and goes straight to the manual fallback.
 */
export class ChunkErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  private reload = () => (this.props.reload ?? (() => window.location.reload()))();

  componentDidCatch(error: unknown) {
    if (!isChunkLoadError(error)) return;
    // Guarded auto-reload: pull the fresh shell once, but never loop if the chunk is genuinely gone.
    // The loop guard needs persistent storage; if it's unavailable, or reading/writing it throws
    // (private/disabled modes — Codex P3), skip the auto-reload and leave the manual Reload fallback
    // rather than reloading with no guard. All storage access is wrapped so a throw here can't break
    // the boundary while it's already handling the chunk-load error.
    const now = (this.props.now ?? Date.now)();
    const store = this.props.storage === undefined ? safeSessionStorage() : this.props.storage;
    if (!store) return;
    try {
      const last = Number(store.getItem(RELOAD_GUARD_KEY) ?? 0);
      if (last && now - last <= RELOAD_WINDOW_MS) return; // just reloaded — don't loop
      store.setItem(RELOAD_GUARD_KEY, String(now));
    } catch {
      return; // storage-hostile: fall back to the manual Reload button
    }
    this.reload();
  }

  render() {
    if (this.state.failed) return <ChunkErrorFallback onReload={this.reload} />;
    return this.props.children;
  }
}

function ChunkErrorFallback({ onReload }: { onReload: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-8 text-center">
      <p className="text-lg font-medium text-foreground">{t('app.loadFailedTitle')}</p>
      <p className="max-w-xs text-sm text-muted-foreground">{t('app.loadFailedHint')}</p>
      <Button onClick={onReload}>{t('app.reload')}</Button>
    </div>
  );
}
