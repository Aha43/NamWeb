import { useState, type ReactNode } from 'react';
import { CaptureContext } from './capture-context';
import { CaptureSheet } from './CaptureSheet';

/** Provides `openCapture()` to the whole app and renders the (single) capture sheet. */
export function CaptureProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <CaptureContext.Provider value={{ openCapture: () => setOpen(true) }}>
      {children}
      <CaptureSheet open={open} onOpenChange={setOpen} />
    </CaptureContext.Provider>
  );
}
