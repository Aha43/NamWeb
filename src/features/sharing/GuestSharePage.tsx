import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown, ChevronRight, MapPin } from 'lucide-react';
import type { ShareContent, ShareCounter, ShareDue, ShareItem, ShareQuestion, ShareSection } from '@/domain/shareContent';
import { parseCount } from '@/domain/resourceCount';
import { parseQuestion, type QuestionAnswer } from '@/domain/resourceQuestion';
import { CountPill } from '@/features/actions/CountPill';
import { QuestionPill } from '@/features/actions/QuestionPill';
import { fetchGuestShare, fetchShareResourceEvents, submitAnswerEvent, submitResourceEvent, submitSuggestion, type ShareResourceEvent } from './shares';

/**
 * The guest page (#761): what a secret share link renders. Deliberately un-NAM — no chrome,
 * no sign-in, no app concepts. The snapshot's envelope is its whole world; the guest's
 * browser locale is its language (the i18n runtime auto-detects); Intl formats the dates.
 * Guest ids become DOM anchors (stage 4's per-item suggestions will address them).
 */
/** Fold an event list into the counter-sum and last-answer overlays (#827). */
function foldEvents(events: ShareResourceEvent[]): { sums: Map<string, number>; answers: Map<string, QuestionAnswer | null> } {
  const sums = new Map<string, number>();
  const answers = new Map<string, QuestionAnswer | null>();
  for (const e of events) {
    const key = `${e.node_id}:${e.res_index}`;
    if (typeof e.delta === 'number') sums.set(key, (sums.get(key) ?? 0) + e.delta);
    else if (e.answer) answers.set(key, e.answer === 'clear' ? null : e.answer); // last wins
  }
  return { sums, answers };
}

function hasInteractive(content: ShareContent): boolean {
  const any = (i: { counters?: unknown[]; questions?: unknown[] }) => (i.counters?.length ?? 0) > 0 || (i.questions?.length ?? 0) > 0;
  const walk = (sections: ShareSection[]): boolean =>
    sections.some((sec) => any(sec) || sec.items.some(any) || walk(sec.sections));
  return content.items.some(any) || walk(content.sections);
}

export function GuestSharePage({ token }: { token: string }) {
  const { t, i18n } = useTranslation();
  const [content, setContent] = useState<ShareContent | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'gone'>('loading');
  // Collapsible sections (#794): default EXPANDED — the page reads exactly as before until a
  // guest chooses focus. Collapse hides details, never existence (headers keep dates + count).
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  // The suggestion box (#796): guests capture, the owner clarifies. sent = the thanks state;
  // failure reads as the same quiet non-acceptance as a dead link (no oracle).
  const [guestName, setGuestName] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [suggestState, setSuggestState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  // Delegated counters (#810): the page shows snapshot + Σ undrained events, so a guest's own
  // ticks land instantly and a stale published count never confuses. Keyed `${nodeId}:${index}`.
  const [ticks, setTicks] = useState<Map<string, number>>(new Map());
  // Question answers (#827): last-answer-wins per node:index, overlaid on the snapshot.
  const [answers, setAnswers] = useState<Map<string, QuestionAnswer | null>>(new Map());
  // id → parent-section id for every section AND item — anchor navigation (TOC taps, #hash
  // deep links, stage 4's per-item suggestions) must expand ancestors before scrolling.
  const parentOf = useMemo(() => {
    const map = new Map<string, string | null>();
    const walk = (sections: readonly { id: string; items: readonly { id: string }[]; sections: readonly never[] | ShareContent['sections'] }[], parent: string | null) => {
      for (const sec of sections) {
        map.set(sec.id, parent);
        for (const item of sec.items) map.set(item.id, sec.id);
        walk(sec.sections as ShareContent['sections'], sec.id);
      }
    };
    if (content) {
      for (const item of content.items) map.set(item.id, null);
      walk(content.sections, null);
    }
    return map;
  }, [content]);

  const toggleSection = (id: string) =>
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** Expand every collapsed ancestor of `id`, then scroll to it (next frame — the target may
   *  be hidden right now). */
  const revealAnchor = useCallback(
    (id: string) => {
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        let cursor: string | null | undefined = id;
        while (cursor) {
          next.delete(cursor);
          cursor = parentOf.get(cursor) ?? null;
        }
        return next;
      });
      requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }));
    },
    [parentOf],
  );

  // A #hash on arrival (a shared deep link) reveals its target once the content is in.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (content && hash && parentOf.has(hash)) revealAnchor(hash);
  }, [content, parentOf, revealAnchor]);

  /** Re-pull the overlay only — cheap, and honest between simultaneous shoppers (#821/F4).
   *  Guarded by generations (#823/P2): a refresh applies only if it is still the LATEST
   *  request and no local tick was accepted while it was in flight — otherwise an older
   *  response would rewind a just-accepted tick or a fresher refresh. */
  const refreshGen = useRef(0);
  const localGen = useRef(0);
  const refreshTicks = useCallback(() => {
    const req = ++refreshGen.current;
    const local = localGen.current;
    fetchShareResourceEvents(token)
      .then((events) => {
        if (req !== refreshGen.current || local !== localGen.current) return; // superseded
        const { sums, answers: ans } = foldEvents(events);
        setTicks(sums);
        setAnswers(ans);
      })
      .catch(() => {});
  }, [token]);

  // Shoppers pocket their phones constantly: coming back to the tab re-pulls the other
  // guests' ticks (#821/F4) — not realtime, just not stale-blind.
  useEffect(() => {
    if (!content || !hasInteractive(content)) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshTicks();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refreshTicks);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refreshTicks);
    };
  }, [content, refreshTicks]);

  const load = useCallback(() => {
    setState('loading');
    fetchGuestShare(token)
      .then(async (c) => {
        // A future envelope version renders as "needs a newer link", never wrong (#772).
        const usable = c && c.version === 1 ? c : null;
        if (usable && hasInteractive(usable)) {
          // Overlay failures degrade to the bare snapshot — the page still renders.
          const events = await fetchShareResourceEvents(token).catch(() => []);
          const { sums, answers: ans } = foldEvents(events);
          setTicks(sums);
          setAnswers(ans);
        }
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

  /** A guest tick: quiet failure by design — a refused tap simply doesn't move. */
  const tick = (nodeId: string, index: number, delta: 1 | -1) =>
    submitResourceEvent(token, nodeId, index, delta)
      .then((ok) => {
        if (!ok) return;
        localGen.current += 1; // invalidate any refresh that was in flight before this tick
        setTicks((prev) => {
          const next = new Map(prev);
          const key = `${nodeId}:${index}`;
          next.set(key, (next.get(key) ?? 0) + delta);
          return next;
        });
      })
      .catch(() => {});

  /** A guest answer (#827): quiet failure by design; the local overlay updates optimistically. */
  const answer = (nodeId: string, index: number, desired: 'yes' | 'no' | 'clear') =>
    submitAnswerEvent(token, nodeId, index, desired)
      .then((ok) => {
        if (!ok) return;
        localGen.current += 1;
        setAnswers((prev) => {
          const next = new Map(prev);
          next.set(`${nodeId}:${index}`, desired === 'clear' ? null : desired);
          return next;
        });
      })
      .catch(() => {});

  const renderQuestions = (nodeId: string, questions: ShareQuestion[] | undefined) => {
    if (!questions?.length) return null;
    return (
      <div className="mt-1 flex flex-col gap-1.5">
        {questions.map((q) => {
          const parsed = parseQuestion(q.value);
          if (!parsed) return null;
          const key = `${nodeId}:${q.index}`;
          const current = answers.has(key) ? answers.get(key)! : parsed.answer;
          return (
            <QuestionPill
              key={`q${q.index}`}
              nodeId={nodeId}
              index={q.index}
              answer={current}
              question={q.question}
              onAnswer={(desired) => void answer(nodeId, q.index, desired)}
            />
          );
        })}
      </div>
    );
  };

  const renderCounters = (nodeId: string, counters: ShareCounter[] | undefined) => {
    if (!counters?.length) return null;
    return (
      <div className="mt-1 flex flex-wrap gap-1.5">
        {counters.map((c) => {
          const parsed = parseCount(c.value);
          if (!parsed) return null; // malformed degrades to nothing, never crashes the page
          const overlaid = parsed.current + (ticks.get(`${nodeId}:${c.index}`) ?? 0);
          // The same display clamp the owner's pill lives by.
          const current = parsed.unlimited ? Math.max(0, overlaid) : Math.max(0, Math.min(overlaid, parsed.target));
          return (
            <CountPill
              key={c.index}
              nodeId={nodeId}
              index={c.index}
              current={current}
              target={parsed.target}
              unlimited={parsed.unlimited}
              onStep={(delta) => void tick(nodeId, c.index, delta)}
              label={c.label ?? null}
            />
          );
        })}
      </div>
    );
  };

  /** Got-it (#817): every delegated counter at/past its goal reads as done in the aisle —
   *  live via the overlay, no republish needed for the visual. */
  const countersMet = (nodeId: string, counters: ShareCounter[] | undefined): boolean => {
    if (!counters?.length) return false;
    return counters.every((c) => {
      const parsed = parseCount(c.value);
      if (!parsed) return false;
      return parsed.current + (ticks.get(`${nodeId}:${c.index}`) ?? 0) >= parsed.target;
    });
  };

  const renderItem = (item: ShareItem) => {
    const gotIt = item.done || countersMet(item.id, item.counters);
    return (
    <li key={item.id} id={item.id} className="flex gap-3 py-2">
      <span
        aria-hidden
        className={
          gotIt
            ? 'mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600'
            : 'mt-1.5 h-2 w-2 shrink-0 translate-x-1 rounded-full bg-primary/40'
        }
      >
        {gotIt && <Check className="h-3 w-3" />}
      </span>
      <div className="min-w-0">
        <p className={gotIt ? 'text-foreground/70 line-through decoration-foreground/30' : 'text-foreground'}>
          {item.title}
        </p>
        {item.due && <p className="text-xs text-muted-foreground">{formatDue(item.due)}</p>}
        {item.note && <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground">{item.note}</p>}
        {renderCounters(item.id, item.counters)}
        {renderQuestions(item.id, item.questions)}
      </div>
    </li>
    );
  };

  const renderSection = (section: ShareSection, depth: number) => {
    const isCollapsed = collapsedIds.has(section.id);
    const count = section.items.length + section.sections.length;
    const Heading = depth === 0 ? 'h2' : 'h3';
    return (
      <section key={section.id} id={section.id} className={depth === 0 ? 'mt-10' : 'mt-6'}>
        {/* The heading IS the disclosure (#794) — chevron, aria-expanded/controls (the house
            pattern). Collapsed headers stay honest: date span + a count, so collapsing hides
            details, never existence. */}
        <Heading className={depth === 0 ? 'text-xl font-semibold tracking-tight text-foreground' : 'text-base font-semibold text-foreground'}>
          <button
            type="button"
            aria-expanded={!isCollapsed}
            aria-controls={`guest-section-${section.id}`}
            onClick={() => toggleSection(section.id)}
            className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-0.5 text-left"
          >
            {isCollapsed ? (
              <ChevronRight aria-hidden className="h-4 w-4 shrink-0 self-center text-muted-foreground" />
            ) : (
              <ChevronDown aria-hidden className="h-4 w-4 shrink-0 self-center text-muted-foreground" />
            )}
            <span>{section.title}</span>
            {section.due && <span className="text-xs font-normal text-muted-foreground">{formatDue(section.due)}</span>}
            {isCollapsed && count > 0 && (
              <span className="text-xs font-normal text-muted-foreground">{t('guest.sectionCount', { count })}</span>
            )}
          </button>
        </Heading>
        <div id={`guest-section-${section.id}`} className={isCollapsed ? 'hidden' : undefined}>
          {section.note && <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{section.note}</p>}
          {renderCounters(section.id, section.counters)}
          {renderQuestions(section.id, section.questions)}
          {section.items.length > 0 && <ul className="mt-2 divide-y divide-border/60">{section.items.map(renderItem)}</ul>}
          {section.sections.map((s) => renderSection(s, depth + 1))}
        </div>
      </section>
    );
  };

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
                  <a
                    href={`#${section.id}`}
                    onClick={(e) => {
                      // Anchor-aware (#794): expand first, scroll next frame — a collapsed
                      // target must never dead-end a TOC tap.
                      e.preventDefault();
                      window.history.replaceState(null, '', `#${section.id}`);
                      revealAnchor(section.id);
                    }}
                    className="group flex flex-wrap items-baseline gap-x-3 gap-y-0.5"
                  >
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

        <section className="mt-12 rounded-lg border border-border bg-card/50 p-4">
          <h2 className="text-base font-semibold text-foreground">{t('guest.suggestTitle')}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t('guest.suggestHint')}</p>
          {suggestState === 'sent' ? (
            <div className="mt-3 flex flex-wrap items-baseline gap-3">
              <p className="text-sm font-medium text-foreground">{t('guest.suggestThanks')}</p>
              <button
                type="button"
                onClick={() => {
                  setSuggestion('');
                  setSuggestState('idle');
                }}
                className="text-sm text-muted-foreground underline hover:text-foreground"
              >
                {t('guest.suggestAnother')}
              </button>
            </div>
          ) : (
            <form
              className="mt-3 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!suggestion.trim()) return;
                setSuggestState('sending');
                submitSuggestion(token, suggestion.trim(), guestName.trim() || undefined)
                  .then((ok) => setSuggestState(ok ? 'sent' : 'failed'))
                  .catch(() => setSuggestState('failed'));
              }}
            >
              <input
                aria-label={t('guest.suggestNameAria')}
                placeholder={t('guest.suggestNamePlaceholder')}
                value={guestName}
                maxLength={100}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-hidden focus:border-ring sm:max-w-xs"
              />
              <textarea
                aria-label={t('guest.suggestBodyAria')}
                placeholder={t('guest.suggestPlaceholder')}
                value={suggestion}
                maxLength={2000}
                rows={3}
                onChange={(e) => setSuggestion(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-hidden focus:border-ring"
              />
              <div className="flex items-center gap-3">
                {/* A VISIBLE submit — the phone form rule (#785): guests are on phones. */}
                <button
                  type="submit"
                  disabled={!suggestion.trim() || suggestState === 'sending'}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
                >
                  {t('guest.suggestSend')}
                </button>
                {suggestState === 'failed' && (
                  <p role="alert" className="text-xs text-muted-foreground">
                    {t('guest.suggestFailed')}
                  </p>
                )}
              </div>
            </form>
          )}
        </section>

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
