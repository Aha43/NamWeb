import { useMemo, useState } from 'react';
import { Check, Copy } from 'lucide-react';
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
import { Tooltip } from '@/components/ui/tooltip';
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
  const { copied, copy } = useCopyToClipboard();

  const markdown = useMemo(() => {
    const statuses: NodeStatus[] = [];
    if (next) statuses.push('NEXT');
    if (backlog) statuses.push('BACKLOG');
    if (done) statuses.push('DONE');
    return buildSummary({ statuses, includeSubProjects });
  }, [next, backlog, done, includeSubProjects, buildSummary]);

  // ⌘/Ctrl+Enter — the "copy & close" power move (the Copy button alone stays copy-only so you can
  // keep tweaking the include-filters).
  function copyAndClose() {
    copy(markdown);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            copyAndClose();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('summary.title', { title })}</DialogTitle>
          <DialogDescription>{t('summary.description')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="text-muted-foreground">{t('summary.include')}</span>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={next} onChange={(e) => setNext(e.target.checked)} />
            {t('domain.status.next')}
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={backlog} onChange={(e) => setBacklog(e.target.checked)} />
            {t('domain.status.backlog')}
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} />
            {t('domain.status.done')}
          </label>
          <label className="flex items-center gap-1.5 sm:ml-auto">
            <input
              type="checkbox"
              checked={includeSubProjects}
              onChange={(e) => setIncludeSubProjects(e.target.checked)}
            />
            {t('summary.includeSub')}
          </label>
        </div>

        <textarea
          readOnly
          aria-label={t('summary.mdAria')}
          value={markdown}
          onFocus={(e) => e.currentTarget.select()}
          className="h-72 w-full resize-none rounded-md border border-input bg-muted/30 p-3 font-mono text-xs text-foreground outline-hidden focus:border-ring"
        />

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('summary.close')}
          </Button>
          <Tooltip label={t('summary.copyTooltip')}>
            <Button type="button" onClick={() => copy(markdown)} className="gap-1.5">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? t('summary.copied') : t('summary.copy')}
            </Button>
          </Tooltip>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
