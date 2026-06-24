import { Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * An icon entry point into the Focus deck — the green-glowing Target "circle" sprinkled across the
 * action lists to promote Focus. `to` is the scoped Focus route (e.g. `/focus`, `/focus?source=due`).
 */
export function FocusButton({ to, label = 'Focus', className }: { to: string; label?: string; className?: string }) {
  const navigate = useNavigate();
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={() => navigate(to)}
        className={cn('rounded-md p-1.5 hover:bg-accent', className)}
      >
        <Target className="focus-glow h-5 w-5" />
      </button>
    </Tooltip>
  );
}
