import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, MapPin } from 'lucide-react';
import type { ShareContent, ShareDue, ShareItem, ShareSection } from '@/domain/shareContent';
import { fetchGuestShare } from './shares';

/**
 * The guest page (#761): what a secret share link renders. Deliberately un-NAM — no chrome,
 * no sign-in, no app concepts. The snapshot's envelope is its whole world; the guest's
 * browser locale is its language (the i18n runtime auto-detects); Intl formats the dates.
 * Guest ids become DOM anchors (stage 4's per-item suggestions will address them).
 */
export function GuestSharePage({ token }: { token: string }) {
  const { t, i18n } = useTranslation();
  const [content, setContent] = useState<ShareContent | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'gone'>('loading');

  const load = useCallback(() => {
    setState('loading');
    fetchGuestShare(token)
      .then((c) => {
        // A future envelope version renders as "needs a newer link", never wrong (#772).
        const usable = c && c.version === 1 ? c : null;
        setContent(usable);
        setState(usable ? 'ready' : 'gone');
      })
      // Network trouble folds into the same quiet state (retry below) — and unknown vs
      // revoked are indistinguishable by design (no oracle for token guessing).
      .catch(() => setState('gone'));
  }, [token]);
  useEffect(load, [load]);

  // The page's identity: the project's title in the tab, and no search engine ever sees it
  // (meta here; X-Robots-Tag for /p/* in public/_headers is the belt to this suspender).
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    const prevTitle = document.title;
    return () => {
      meta.remove();
      document.title = prevTitle;
    };
  }, []);
  useEffect(() => {
    if (content) document.title = content.title;
  }, [content]);

  const formatDue = (due: ShareDue): string => {
    const locale = i18n.language;
    const fmt = (iso: string, time?: string) => {
      const date = new Date(`${iso}T00:00:00`);
      const day = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
      return time ? `${day} ${time}` : day;
    };
    return due.end ? `${fmt(due.start, due.startTime)} – ${fmt(due.end, due.endTime)}` : fmt(due.start, due.startTime);
  };

  if (state === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted-foreground">
        {t('guest.loading')}
      </div>
    );
  }

  if (state === 'gone' || !content) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <p className="text-lg font-medium text-foreground">{t('guest.goneTitle')}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{t('guest.goneBody')}</p>
        <button type="button" onClick={load} className="text-sm text-muted-foreground underline hover:text-foreground">
          {t('guest.retry')}
        </button>
      </div>
    );
  }

  const renderItem = (item: ShareItem) => (
    <li key={item.id} id={item.id} className="flex gap-3 py-2">
      <span
        aria-hidden
        className={
          item.done
            ? 'mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600'
            : 'mt-1.5 h-2 w-2 shrink-0 translate-x-1 rounded-full bg-primary/40'
        }
      >
        {item.done && <Check className="h-3 w-3" />}
      </span>
      <div className="min-w-0">
        <p className={item.done ? 'text-foreground/70 line-through decoration-foreground/30' : 'text-foreground'}>
          {item.title}
        </p>
        {item.due && <p className="text-xs text-muted-foreground">{formatDue(item.due)}</p>}
        {item.note && <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{item.note}</p>}
      </div>
    </li>
  );

  const renderSection = (section: ShareSection, depth: number) => (
    <section key={section.id} id={section.id} className={depth === 0 ? 'mt-10' : 'mt-6'}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        {depth === 0 ? (
          <h2 className="text-xl font-semibold tracking-tight text-foreground">{section.title}</h2>
        ) : (
          <h3 className="text-base font-semibold text-foreground">{section.title}</h3>
        )}
        {section.due && <span className="text-xs text-muted-foreground">{formatDue(section.due)}</span>}
      </div>
      {section.note && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{section.note}</p>}
      {section.items.length > 0 && <ul className="mt-2 divide-y divide-border/60">{section.items.map(renderItem)}</ul>}
      {section.sections.map((s) => renderSection(s, depth + 1))}
    </section>
  );

  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
        <header>
          <div className="flex items-center gap-2 text-primary">
            <MapPin className="h-5 w-5" aria-hidden />
            {content.due && <span className="text-sm font-medium">{formatDue(content.due)}</span>}
          </div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{content.title}</h1>
          {content.note && <p className="mt-3 whitespace-pre-wrap text-base text-muted-foreground">{content.note}</p>}
        </header>

        {content.sections.length > 0 && (
          /* The TOC (#792): always on when sections exist — small, familiar, and the trip
             page's front door. Anchors ride the stage-1 pseudonymous ids. Renderer-only:
             every existing link gets it without a republish. */
          <nav aria-label={t('guest.contents')} className="mt-8 rounded-lg border border-border bg-card/50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('guest.contents')}</p>
            <ul className="mt-2 space-y-1">
              {content.sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="group flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                    <span className="font-medium text-foreground group-hover:underline">{section.title}</span>
                    {section.due && <span className="text-xs text-muted-foreground">{formatDue(section.due)}</span>}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {content.items.length > 0 && <ul className="mt-8 divide-y divide-border/60">{content.items.map(renderItem)}</ul>}
        {content.sections.map((s) => renderSection(s, 0))}

        <footer className="mt-14 border-t border-border pt-4 text-xs text-muted-foreground">
          {t('guest.sharedFrom')}{' '}
          <a href={window.location.origin} className="underline hover:text-foreground">
            NAM
          </a>
        </footer>
      </main>
    </div>
  );
}
