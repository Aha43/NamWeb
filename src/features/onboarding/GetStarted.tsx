import { Plus, X } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  return (
    <section className="relative mb-6 rounded-lg border border-border bg-card p-5">
      <button
        type="button"
        aria-label={t('getStarted.dismissAria')}
        onClick={onDismiss}
        className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <h2 className="text-base font-semibold text-foreground">{t('getStarted.welcome')}</h2>
      <p className="mt-1 max-w-prose text-sm text-muted-foreground">
        <Trans i18nKey="getStarted.steps" components={{ b: <span className="font-medium text-foreground" /> }} />
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button className="gap-2" onClick={onCapture}>
          <Plus className="h-4 w-4" />
          {t('getStarted.captureFirst')}
        </Button>
        <Button variant="outline" onClick={onAddLearnNam}>
          {t('projects.addLearnNamLink')}
        </Button>
      </div>
    </section>
  );
}
