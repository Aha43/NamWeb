import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Pencil, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCopyToClipboard } from '@/lib/useCopyToClipboard';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { NodeStatus } from '@/domain/types';
import type { SummaryOptions } from '@/domain/projectSummary';

/** Shows a project's Markdown summary (status- + scope-filtered) in a copyable, selectable area. */
export function ProjectSummaryDialog({
  open,
  onOpenChange,
  title,
  buildSummary,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Render the summary Markdown for the chosen options. */
  buildSummary: (options: SummaryOptions) => string;
}) {
  const { t } = useTranslation();
  const [next, setNext] = useState(true);
  const [backlog, setBacklog] = useState(true);
  const [done, setDone] = useState(false);
  const [includeSubProjects, setIncludeSubProjects] = useState(true);
  // In-place edits before copying (#729): null = live generated view; a string = the user's
  // draft, seeded from the generated Markdown by Edit. While a draft exists the include-filters
  // are disabled — they describe the *generated* text, and regenerating under an edit would
  // clobber it. Regenerate discards the draft (the easy undo) and re-enables them.
  const [draft, setDraft] = useState<string | null>(null);
  const { copied, copy } = useCopyToClipboard();

  const markdown = useMemo(() => {
    const statuses: NodeStatus[] = [];
    if (next) statuses.push('NEXT');
    if (backlog) statuses.push('BACKLOG');
    if (done) statuses.push('DONE');
    return buildSummary({ statuses, includeSubProjects });
  }, [next, backlog, done, includeSubProjects, buildSummary]);

  // The dialog stays mounted across opens — a stale draft must not greet the next open.
  useEffect(() => {
    if (open) setDraft(null);
  }, [open]);

  const editing = draft !== null;
  const shown = draft ?? markdown;
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Escape / overlay / Close with un-copied edits must not silently throw them away (#735):
  // Regenerate is the deliberate discard — a close asks first. An untouched draft closes freely.
  function handleOpenChange(next: boolean) {
    if (!next && draft !== null && draft !== markdown) {
      setConfirmDiscard(true);
      return;
    }
    onOpenChange(next);
  }

  // ⌘/Ctrl+Enter — the "copy & close" power move (the Copy button alone stays copy-only so you can
  // keep tweaking the include-filters). Skips the discard guard: the copy is what makes it safe.
  function copyAndClose() {
    copy(shown);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            copyAndClose();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('summary.title', { title })}</DialogTitle>
          <DialogDescription>{t('summary.description')}</DialogDescription>
        </DialogHeader>

        <div className={cn('flex flex-wrap items-center gap-4 text-sm', editing && 'opacity-50')}>
          <span className="text-muted-foreground">{t('summary.include')}</span>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" disabled={editing} checked={next} onChange={(e) => setNext(e.target.checked)} />
            {t('domain.status.next')}
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" disabled={editing} checked={backlog} onChange={(e) => setBacklog(e.target.checked)} />
            {t('domain.status.backlog')}
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" disabled={editing} checked={done} onChange={(e) => setDone(e.target.checked)} />
            {t('domain.status.done')}
          </label>
          <label className="flex items-center gap-1.5 sm:ml-auto">
            <input
              type="checkbox"
              disabled={editing}
              checked={includeSubProjects}
              onChange={(e) => setIncludeSubProjects(e.target.checked)}
            />
            {t('summary.includeSub')}
          </label>
        </div>

        <textarea
          readOnly={!editing}
          aria-label={t('summary.mdAria')}
          value={shown}
          onChange={(e) => {
            if (editing) setDraft(e.target.value);
          }}
          // Select-all is the copy affordance of the read-only view; while editing, the caret is king.
          onFocus={(e) => {
            if (!editing) e.currentTarget.select();
          }}
          className="h-72 w-full resize-none rounded-md border border-input bg-muted/30 p-3 font-mono text-xs text-foreground outline-hidden focus:border-ring"
        />

        <DialogFooter>
          {editing ? (
            <Tooltip label={t('summary.regenerateTooltip')}>
              <Button type="button" variant="outline" onClick={() => setDraft(null)} className="gap-1.5 sm:mr-auto">
                <RotateCcw className="h-4 w-4" />
                {t('summary.regenerate')}
              </Button>
            </Tooltip>
          ) : (
            <Tooltip label={t('summary.editTooltip')}>
              <Button type="button" variant="outline" onClick={() => setDraft(markdown)} className="gap-1.5 sm:mr-auto">
                <Pencil className="h-4 w-4" />
                {t('summary.edit')}
              </Button>
            </Tooltip>
          )}
          <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
            {t('summary.close')}
          </Button>
          <Tooltip label={t('summary.copyTooltip')}>
            <Button type="button" onClick={() => copy(shown)} className="gap-1.5">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? t('summary.copied') : t('summary.copy')}
            </Button>
          </Tooltip>
        </DialogFooter>
        <ConfirmDialog
          open={confirmDiscard}
          onOpenChange={setConfirmDiscard}
          title={t('summary.discardTitle')}
          message={t('summary.discardMessage')}
          confirmLabel={t('summary.discardConfirm')}
          onConfirm={() => {
            setConfirmDiscard(false);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
