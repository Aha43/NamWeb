import { useContext } from 'react';
import { Button } from '@/components/ui/button';
import { DemoContext } from './demo-context';

/** Persistent demo notice: explains the no-save semantics and offers Reset + the sign-up CTA. */
export function DemoBanner() {
  const demo = useContext(DemoContext);
  if (!demo) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-primary px-3 py-1.5 text-center text-xs text-primary-foreground">
      <span>You're in a demo — changes stay on this device.</span>
      <button type="button" onClick={demo.reset} className="underline underline-offset-2 hover:opacity-80">
        Reset demo
      </button>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={demo.signUp}
        className="h-6 px-2 py-0 text-xs"
      >
        Sign up to keep your work
      </Button>
    </div>
  );
}
