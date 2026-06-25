import { createContext, useContext } from 'react';

export interface ToastOptions {
  message: string;
  /** Optional action button (e.g. "Undo"). */
  actionLabel?: string;
  onAction?: () => void;
  /** Auto-dismiss after this many ms (default 6000). */
  durationMs?: number;
}

export interface ToastContextValue {
  toast: (options: ToastOptions) => void;
}

export const ToastContext = createContext<ToastContextValue | undefined>(undefined);

/**
 * Transient bottom toasts. Falls back to a no-op when no provider is mounted, so components that
 * fire a toast still work in isolation (incl. tests) without wrapping them in a provider.
 */
export function useToast(): ToastContextValue {
  return useContext(ToastContext) ?? { toast: () => {} };
}
