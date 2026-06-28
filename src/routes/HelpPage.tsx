import { useNavigate } from 'react-router-dom';
import { buildLearnNam } from '@/domain/learnNam';
import { newId, nowIso } from '@/lib/local';
import { Button } from '@/components/ui/button';
import { VersionBadge } from '@/components/VersionBadge';
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
          <li><span className="font-medium text-foreground">Clarify</span> each inbox item: is it a <span className="font-medium text-foreground">Next</span> action (do soon), <span className="font-medium text-foreground">Backlog</span> (later), or a <span className="font-medium text-foreground">Project</span> (needs steps)? You can also file it straight into an existing project as you clarify.</li>
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
            ['Tags', 'Filter by a context (tag), then Focus just those — and manage your tags.'],
            ['Search', 'Find any action or project by title or tag.'],
            ['Done', 'Completed actions — select several to restore or re-triage in bulk.'],
            ['Focus', 'Work one card at a time — enter from Next, Backlog, Due, Done, or Inbox.'],
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
        <p className="text-sm text-muted-foreground">Anywhere in the app:</p>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">c</kbd> — capture a thought</li>
          <li><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">t</kbd> — flip new items add to top / bottom</li>
          <li><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">/</kbd> — jump to search</li>
          <li>
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">g</kbd> then a letter — go to a view:{' '}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">i</kbd> Inbox,{' '}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">n</kbd> Next,{' '}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">b</kbd> Backlog,{' '}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">d</kbd> Due,{' '}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">k</kbd> Blocked,{' '}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">p</kbd> Projects,{' '}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">o</kbd> Goals,{' '}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">t</kbd> Tags,{' '}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">e</kbd> Done,{' '}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">f</kbd> Focus
          </li>
          <li><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">?</kbd> — open this Help page</li>
        </ul>
        <p className="text-sm text-muted-foreground">On a project workbench:</p>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">x</kbd> — toggle Details · <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">y</kbd> — toggle Actions · <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">z</kbd> — toggle Sub-projects</li>
        </ul>
        <p className="text-sm text-muted-foreground">In Focus mode:</p>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">←</kbd> / <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">→</kbd> — previous / next card</li>
          <li><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">Space</kbd> — mark the card done</li>
          <li><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">e</kbd> — open the editor · <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">r</kbd> — rename · <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">f</kbd> — move (re-triage) · <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">Del</kbd> — delete</li>
          <li><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">Esc</kbd> — exit Focus</li>
        </ul>
        <p className="text-sm text-muted-foreground">In the action/project editor:</p>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">⌘</kbd> /{' '}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">Ctrl</kbd> +{' '}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">Enter</kbd> — save
          </li>
          <li><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">Esc</kbd> — cancel</li>
        </ul>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Good to know</h2>
        <ul className="ml-5 list-disc space-y-1 text-sm text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Tags rub off.</span> A tag on a project applies to
            everything inside it — its actions and sub-projects show that tag in <span className="italic">italics</span>,
            and it filters and searches just like a tag you set directly.
          </li>
          <li>
            <span className="font-medium text-foreground">Archive finished projects.</span> Archiving a project
            (from the Projects view) tucks it away — it and its actions drop out of Next, Backlog, Due, and the
            project pickers. Use <span className="font-medium text-foreground">Show archived</span> to bring it back.
          </li>
          <li>
            <span className="font-medium text-foreground">Quick row actions.</span> Click an action's title to open
            it, and use the copy icon on any row to copy its name.
          </li>
          <li>
            <span className="font-medium text-foreground">Bookmark what you return to.</span> Use the bookmark icon on a
            project or a tag filter to pin it to the toolbar as a colored icon — one click jumps you back. Hover a
            bookmark to remove it. Bookmarks sync with your workspace.
          </li>
          <li>
            <span className="font-medium text-foreground">Focus from anywhere.</span> The green glowing button on
            <span className="font-medium text-foreground"> Next</span>, <span className="font-medium text-foreground">Backlog</span>,
            <span className="font-medium text-foreground"> Due</span>, <span className="font-medium text-foreground">Done</span>, and
            <span className="font-medium text-foreground"> Inbox</span> drops you into a one-card-at-a-time deck. From a card you can
            open the editor, rename, copy, delete, or move it to Backlog — and on <span className="font-medium text-foreground">Done</span>
            you can re-triage the ones that weren't really done (restore to Next, park in Backlog, or delete).
          </li>
          <li>
            <span className="font-medium text-foreground">Choose where new items land.</span> Each add box has a small
            top/bottom toggle — flip it right where you add for a here-and-now choice that resets on reload. Set your
            default in <span className="font-medium text-foreground">Settings → Preferences</span>.
          </li>
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

      <footer className="border-t border-border pt-4">
        <VersionBadge />
      </footer>
    </section>
  );
}
