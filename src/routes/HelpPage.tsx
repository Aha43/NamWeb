import { useNavigate } from 'react-router-dom';
import { buildLearnNam } from '@/domain/learnNam';
import { newId, nowIso } from '@/lib/local';
import { Button } from '@/components/ui/button';
import { useWorkspaceContext } from '@/store/workspace-context';

/** A simple in-app help surface: how the app's loop works, what each surface is for, the keyboard
 *  shortcuts, and a one-click way to learn by doing. */
export function HelpPage() {
  const { document, dispatch } = useWorkspaceContext();
  const navigate = useNavigate();

  const addLearnNam = () => {
    if (!document) return;
    const seed = buildLearnNam(newId, new Date());
    dispatch({ type: 'seedProject', parentId: document.projectsNodeId, nodes: [seed], now: nowIso() });
    navigate(`/projects/${seed.id}`);
  };

  return (
    <section className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Help</h1>
        <p className="text-sm text-muted-foreground">How NAM works, what each view is for, and a few shortcuts.</p>
      </header>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">How NAM works</h2>
        <p className="text-sm text-foreground">
          The loop is <span className="font-medium">Capture → Clarify → Focus</span>:
        </p>
        <ol className="ml-5 list-decimal space-y-1 text-sm text-muted-foreground">
          <li><span className="font-medium text-foreground">Capture</span> anything on your mind into the Inbox — don't stop to organize.</li>
          <li><span className="font-medium text-foreground">Clarify</span> each inbox item: is it a <span className="font-medium text-foreground">Next</span> action (do soon), <span className="font-medium text-foreground">Backlog</span> (later), or a <span className="font-medium text-foreground">Project</span> (needs steps)?</li>
          <li><span className="font-medium text-foreground">Focus</span> to work through your Next actions one card at a time.</li>
        </ol>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">The views</h2>
        <dl className="space-y-1.5 text-sm">
          {[
            ['Inbox', 'Capture now, decide later.'],
            ['Next', 'The actions you’ve decided to do now.'],
            ['Backlog', 'Things to do later — not now.'],
            ['Due', 'Actions with a due date, grouped by urgency.'],
            ['Blocked', 'Actions waiting on a prerequisite.'],
            ['Projects', 'Group related actions; plan bigger outcomes.'],
            ['Goals', 'Tag-grouped boards to track progress (Mission Control).'],
            ['Templates', 'Reusable project structures.'],
            ['Tags', 'Filter by tag, and manage your tags.'],
            ['Done', 'Completed actions.'],
            ['Focus', 'Execute one action at a time.'],
          ].map(([name, desc]) => (
            <div key={name} className="flex gap-2">
              <dt className="w-24 shrink-0 font-medium text-foreground">{name}</dt>
              <dd className="text-muted-foreground">{desc}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Keyboard shortcuts</h2>
        <p className="text-sm text-muted-foreground">In Focus mode:</p>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">←</kbd> / <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">→</kbd> — previous / next card</li>
          <li><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">Space</kbd> — mark the card done</li>
          <li><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">Esc</kbd> — exit Focus</li>
        </ul>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Learn by doing</h2>
        <p className="text-sm text-muted-foreground">
          The <span className="font-medium text-foreground">Learn NAM</span> project is a hands-on tour — real
          tasks you complete on the project itself to learn each feature.
        </p>
        <Button variant="outline" onClick={addLearnNam}>Add the Learn NAM project 🥋</Button>
      </div>
    </section>
  );
}
