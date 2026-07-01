import { useNavigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { buildLearnNam } from '@/domain/learnNam';
import { newId, nowIso } from '@/lib/local';
import { Button } from '@/components/ui/button';
import { VersionBadge } from '@/components/VersionBadge';
import { useWorkspaceContext } from '@/store/workspace-context';

// Shared inline markup for the rich help paragraphs (bold / italic runs inside translated strings).
const RICH = {
  b: <span className="font-medium text-foreground" />,
  i: <span className="italic" />,
};

/** A simple in-app help surface: how the app's loop works, what each surface is for, the keyboard
 *  shortcuts, and a one-click way to learn by doing. */
export function HelpPage() {
  const { t } = useTranslation();
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
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{t('nav.help')}</h1>
        <p className="text-sm text-muted-foreground">{t('help.subtitle')}</p>
      </header>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('help.howItWorks')}</h2>
        <p className="text-sm text-foreground">
          <Trans i18nKey="help.loopIntro" components={RICH} />
        </p>
        <ol className="ml-5 list-decimal space-y-1 text-sm text-muted-foreground">
          <li><Trans i18nKey="help.loopCapture" components={RICH} /></li>
          <li><Trans i18nKey="help.loopClarify" components={RICH} /></li>
          <li><Trans i18nKey="help.loopFocus" components={RICH} /></li>
        </ol>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('help.views')}</h2>
        <dl className="space-y-1.5 text-sm">
          {[
            ['domain.inbox', 'help.viewInbox'],
            ['domain.status.next', 'help.viewNext'],
            ['domain.status.backlog', 'help.viewBacklog'],
            ['domain.due', 'help.viewDue'],
            ['domain.blocked', 'help.viewBlocked'],
            ['domain.projects', 'help.viewProjects'],
            ['domain.goals', 'help.viewGoals'],
            ['domain.templates', 'help.viewTemplates'],
            ['domain.tags', 'help.viewTags'],
            ['domain.search', 'help.viewSearch'],
            ['domain.status.done', 'help.viewDone'],
            ['domain.focus', 'help.viewFocus'],
          ].map(([nameKey, descKey]) => (
            <div key={nameKey} className="flex gap-2">
              <dt className="w-24 shrink-0 font-medium text-foreground">{t(nameKey)}</dt>
              <dd className="text-muted-foreground">{t(descKey)}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('help.shortcuts')}</h2>
        <p className="text-sm text-muted-foreground">{t('help.scAnywhere')}</p>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">c</kbd> {t('help.scCapture')}</li>
          <li><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">t</kbd> {t('help.scFlip')}</li>
          <li><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">/</kbd> {t('help.scJumpSearch')}</li>
          <li>
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">g</kbd> {t('help.scGoto')}{' '}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">i</kbd> {t('domain.inbox')},{' '}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">n</kbd> {t('domain.status.next')},{' '}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">b</kbd> {t('domain.status.backlog')},{' '}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">d</kbd> {t('domain.due')},{' '}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">k</kbd> {t('domain.blocked')},{' '}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">p</kbd> {t('domain.projects')},{' '}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">o</kbd> {t('domain.goals')},{' '}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">t</kbd> {t('domain.tags')},{' '}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">e</kbd> {t('domain.status.done')},{' '}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">f</kbd> {t('domain.focus')}
          </li>
          <li><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">?</kbd> {t('help.scHelp')}</li>
        </ul>
        <p className="text-sm text-muted-foreground">{t('help.scWorkbenchLabel')}</p>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">x</kbd> {t('help.scDetails')} <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">y</kbd> {t('help.scActions')} <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">z</kbd> {t('help.scSubprojects')} <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">s</kbd> {t('help.scSummary')}</li>
        </ul>
        <p className="text-sm text-muted-foreground">{t('help.scFocusLabel')}</p>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">←</kbd> / <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">→</kbd> {t('help.scPrevNext')}</li>
          <li><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">Space</kbd> {t('help.scSpace')}</li>
          <li><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">e</kbd> {t('help.scEdit')} <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">r</kbd> {t('help.scRename')} <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">f</kbd> {t('help.scMove')} <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">Del</kbd> {t('help.scDelete')}</li>
          <li><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">Esc</kbd> {t('help.scEscFocus')}</li>
        </ul>
        <p className="text-sm text-muted-foreground">{t('help.scEditorLabel')}</p>
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">⌘</kbd> /{' '}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">Ctrl</kbd> +{' '}
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">Enter</kbd> {t('help.scSave')}
          </li>
          <li><kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">Esc</kbd> {t('help.scCancel')}</li>
        </ul>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('help.goodToKnow')}</h2>
        <ul className="ml-5 list-disc space-y-1 text-sm text-muted-foreground">
          <li><Trans i18nKey="help.gtkTags" components={RICH} /></li>
          <li><Trans i18nKey="help.gtkArchive" components={RICH} /></li>
          <li><Trans i18nKey="help.gtkRowActions" components={RICH} /></li>
          <li><Trans i18nKey="help.gtkBookmark" components={RICH} /></li>
          <li><Trans i18nKey="help.gtkFocus" components={RICH} /></li>
          <li><Trans i18nKey="help.gtkNewItems" components={RICH} /></li>
        </ul>
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t('help.learnByDoing')}</h2>
        <p className="text-sm text-muted-foreground">
          <Trans i18nKey="help.learnBody" components={RICH} />
        </p>
        <Button variant="outline" onClick={addLearnNam}>{t('projects.addLearnNamLink')}</Button>
      </div>

      <footer className="border-t border-border pt-4">
        <VersionBadge />
      </footer>
    </section>
  );
}
