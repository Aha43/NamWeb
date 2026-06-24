import { createContext } from 'react';

/** Controls available inside the no-account demo. Undefined outside demo mode. */
export interface DemoControls {
  /** Restore the seeded demo workspace (document only). */
  reset: () => void;
  /** Leave the demo and go to sign-up (the conversion path). */
  signUp: () => void;
}

export const DemoContext = createContext<DemoControls | undefined>(undefined);
