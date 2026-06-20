import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/** Shows a project's Markdown summary in a copyable, selectable text area. Presentational. */
export function ProjectSummaryDialog({
  open,
  onOpenChange,
  title,
  markdown,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  markdown: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable; the text is selectable so it can be copied manually.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Summary — {title}</DialogTitle>
          <DialogDescription>Markdown summary of this project's actions — copy and paste anywhere.</DialogDescription>
        </DialogHeader>
        <textarea
          readOnly
          aria-label="Project summary (Markdown)"
          value={markdown}
          onFocus={(e) => e.currentTarget.select()}
          className="h-72 w-full resize-none rounded-md border border-input bg-muted/30 p-3 font-mono text-xs text-foreground outline-none focus:border-ring"
        />
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" onClick={copy} className="gap-1.5">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
