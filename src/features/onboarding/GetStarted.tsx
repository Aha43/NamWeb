import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * First-run / empty-workspace on-ramp: names the Capture → Clarify → Focus loop and offers the two
 * ways to begin — capture a thought, or add the learn-by-doing "Learn NAM" project. Dismissible, and
 * the caller only renders it while the workspace is essentially empty.
 */
export function GetStarted({
  onCapture,
  onAddLearnNam,
  onDismiss,
}: {
  onCapture: () => void;
  onAddLearnNam: () => void;
  onDismiss: () => void;
}) {
  return (
    <section className="relative mb-6 rounded-lg border border-border bg-card p-5">
      <button
        type="button"
        aria-label="Dismiss get started"
        onClick={onDismiss}
        className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <h2 className="text-base font-semibold text-foreground">Welcome to NAM 👋</h2>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        Three steps: <span className="font-medium text-foreground">Capture</span> anything that's on
        your mind, <span className="font-medium text-foreground">Clarify</span> it into a Next action
        or Backlog, then <span className="font-medium text-foreground">Focus</span> to actually do it.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button className="gap-2" onClick={onCapture}>
          <Plus className="h-4 w-4" />
          Capture your first thought
        </Button>
        <Button variant="outline" onClick={onAddLearnNam}>
          Add the Learn NAM project 🥋
        </Button>
      </div>
    </section>
  );
}
