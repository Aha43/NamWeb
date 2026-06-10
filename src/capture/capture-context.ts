import { createContext, useContext } from 'react';

export interface CaptureContextValue {
  openCapture: () => void;
}

export const CaptureContext = createContext<CaptureContextValue | undefined>(undefined);

export function useCapture(): CaptureContextValue {
  const ctx = useContext(CaptureContext);
  if (!ctx) throw new Error('useCapture must be used within a CaptureProvider');
  return ctx;
}
