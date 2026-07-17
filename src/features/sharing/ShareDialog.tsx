import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { Tooltip } from '@/components/ui/tooltip';
import { useCopyToClipboard } from '@/lib/useCopyToClipboard';
import { useWorkspaceContext } from '@/store/workspace-context';
import { useAuthUser } from '@/auth/auth-context';
import { shareContent, SHARE_DEFAULT_OPTIONS } from '@/domain/shareContent';
import { canonicalTag, PRIVATE_TAG } from '@/domain/systemTags';
import { subtreeIds } from '@/domain/lenses';
import { newId, nowIso } from '@/lib/local';
import {
  canonicalSnapshot,
  fetchShare,
  fetchSuggestions,
  publishShare,
  resolveSuggestion,
  rotateShareToken,
  shareUrl,
  unpublishShare,
  countShareEvents,
  type ProjectShare,
  type ShareSuggestion,
} from './shares';
import { drainShare } from './drainShare';

/**
 * The owner's Share dialog (#759, stage 1 of the sharing epic). Publish mints the secret
 * link; republish refreshes the snapshot; unpublish/rotate kill the old link (confirmed).
 * The dialog is where the snapshot's shape is chosen (field toggles) and where exclusions
 * are made visible (the private-tag count). Labs-gated by the caller.
 */
export function ShareDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { document, dispatch, flush } = useWorkspaceContext();
  const user = useAuthUser();
  const { copied, copy } = useCopyToClipboard();

  const [share, setShare] = useState<ProjectShare | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<ShareSuggestion[]>([]);
  const [guestTicks, setGuestTicks] = useState(0);
  const drainRef = useRef({ document, dispatch, flush });
  drainRef.current = { document, dispatch, flush };
  const [includeDue, setIncludeDue] = useState<boolean>(SHARE_DEFAULT_OPTIONS.includeDue);
  const [includeStatus, setIncludeStatus] = useState<boolean>(SHARE_DEFAULT_OPTIONS.includeStatus);
  const [includeNotes, setIncludeNotes] = useState<boolean>(SHARE_DEFAULT_OPTIONS.includeNotes);
  const [includeDone, setIncludeDone] = useState(true);

  // Load the existing share on open; reset transient state so a previous project's share
  // never greets this one (the dialog stays mounted, driven by open).
  useEffect(() => {
    if (!open) return;
    setShare(null);
    setSuggestions([]); // a previous project's tray must not greet this one (#804)
    setGuestTicks(0);
    setError(null);
    setLoading(true);
    let cancelled = false;
    fetchShare(projectId)
      .then(async (s) => {
        if (cancelled) return;
        setShare(s);
        // Re-seed the toggles from HOW the share was published (#823/P2): a hide-completed
        // share must not open dirty and re-expose its hidden items on a routine republish.
        const opts = s?.content?.options;
        if (opts) {
          setIncludeDue(opts.includeDue);
          setIncludeStatus(opts.includeStatus);
          setIncludeNotes(opts.includeNotes);
          setIncludeDone(opts.includeDone);
        } else {
          setIncludeDue(SHARE_DEFAULT_OPTIONS.includeDue);
          setIncludeStatus(SHARE_DEFAULT_OPTIONS.includeStatus);
          setIncludeNotes(SHARE_DEFAULT_OPTIONS.includeNotes);
          setIncludeDone(true);
        }
        // Count queued ticks BEFORE the drain lands (and deletes) them (#821): the line
        // reads "new since your last look". Then the dialog-open drain (#811) — a failed
        // drain is quiet (retried on the next trigger). The ref keeps the load effect's
        // deps honest (document churns every mutation), and the GETTER resolves the doc
        // after the claim (#821/F2).
        const ticks = s ? await countShareEvents(s.share_id).catch(() => 0) : 0;
        if (s) await drainShare(() => drainRef.current.document, drainRef.current.dispatch, drainRef.current.flush, s).catch(() => {});
        // The From-guests tray (#796): unhandled suggestions ride along with the share.
        const tray = s ? await fetchSuggestions(s.share_id) : [];
        if (cancelled) return; // the await above can outlive a close/project switch (#804)
        setSuggestions(tray);
        setGuestTicks(ticks);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

  const privateCount = useMemo(() => {
    if (!document || !open) return 0;
    let count = 0;
    for (const id of subtreeIds(document, projectId)) {
      const node = document.nodes[id];
      if (node && node.tags.some((tag) => canonicalTag(tag) === PRIVATE_TAG)) count++;
    }
    return count;
  }, [document, projectId, open]);

  const buildContent = useCallback(
    (salt: string) =>
      document
        ? shareContent(document, projectId, {
            includeDue,
            includeStatus,
            includeNotes,
            includeDone,
            salt,
            publishedAt: new Date().toISOString(),
          })
        : null,
    [document, projectId, includeDue, includeStatus, includeNotes, includeDone],
  );

  // The changes-since-publish hint: recompute the snapshot with the stored share's own salt
  // and compare (publishedAt aside) — CANONICALIZED (#772/F2): jsonb reorders keys, so a
  // stringify of insertion order was permanently "dirty" against any round-tripped row.
  const dirty = useMemo(() => {
    if (!share) return false;
    const now = buildContent(share.token);
    if (!now) return true;
    const strip = (c: object) => canonicalSnapshot({ ...c, publishedAt: null });
    return strip(now) !== strip(share.content);
  }, [share, buildContent]);

  // #821/F3: the composed shopping lifecycle can strand items guests can't see — reopened
  // after a hide-completed publish, or newly added ("we need axes"). The cue counts ids the
  // NEXT publish would reveal, so a dirty share says what the republish is FOR.
  const invisibleToGuests = useMemo(() => {
    if (!share || !dirty) return 0;
    const now = buildContent(share.token);
    if (!now) return 0;
    // Defensive: a round-tripped/minimal stored content may lack the arrays entirely.
    const ids = (c: { items?: { id: string }[]; sections?: { id: string; items?: { id: string }[] }[] }): string[] => [
      ...(c.items ?? []).map((i) => i.id),
      ...(c.sections ?? []).flatMap((sec) => ids(sec as never)),
      ...(c.sections ?? []).map((sec) => sec.id),
    ];
    const published = new Set(ids(share.content as never));
    return ids(now as never).filter((id) => !published.has(id)).length;
  }, [share, dirty, buildContent]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const publish = () =>
    run(async () => {
      const content = buildContent(share?.token ?? 'unpublished');
      if (!content || !user) return;
      // First publish mints the token, then the content is rebuilt with it as the
      // pseudonymization salt so guest ids are stable across republishes.
      const next = await publishShare(user.id, projectId, content, Boolean(share));
      if (!next) {
        // Unpublished elsewhere mid-dialog (#774): honor the revocation — never silently mint
        // a fresh link. The dialog drops to "Not published"; publishing again is one click,
        // but it's the USER'S click.
        setShare(null);
        setError(t('share.vanished'));
        return;
      }
      if (!share) {
        const salted = buildContent(next.token);
        if (salted) {
          setShare((await publishShare(user.id, projectId, salted, true)) ?? next);
          return;
        }
      }
      setShare(next);
    });

  const unpublish = () =>
    run(async () => {
      if (!share) return;
      await unpublishShare(share.token);
      setShare(null);
      setSuggestions([]); // unpublish cascades the rows server-side (#804)
      setGuestTicks(0); // the events cascade with them (#811)
    });

  const rotate = () =>
    run(async () => {
      if (!share || !user) return;
      const token = await rotateShareToken(share.token);
      // Re-mint guest ids under the new salt — the old link (and its ids) are dead anyway.
      const content = buildContent(token);
      if (content) {
        setShare((await publishShare(user.id, projectId, content, true)) ?? { ...share, token });
      } else {
        setShare({ ...share, token });
      }
    });

  // Guests capture, the owner clarifies (#796): adoption creates an inbox item whose note
  // carries the provenance (who, when, via the shared page); either path retires the
  // suggestion from the tray.
  const adopt = (suggestion: ShareSuggestion) =>
    run(async () => {
      const id = newId();
      const now = nowIso();
      dispatch({ type: 'addInboxItem', id, title: suggestion.body.slice(0, 200), atTop: true, now });
      const provenance = t('share.suggestionProvenance', {
        name: suggestion.guest_name ?? t('share.suggestionAnonymous'),
        date: new Date(suggestion.created_at).toLocaleDateString(),
      });
      const note = suggestion.body.length > 200 ? `${suggestion.body}\n\n${provenance}` : provenance;
      dispatch({ type: 'updateNode', id, title: suggestion.body.slice(0, 200), description: note, now });
      await resolveSuggestion(suggestion.id);
      setSuggestions((prev) => prev.filter((sg) => sg.id !== suggestion.id));
    });

  const dismiss = (suggestion: ShareSuggestion) =>
    run(async () => {
      await resolveSuggestion(suggestion.id);
      setSuggestions((prev) => prev.filter((sg) => sg.id !== suggestion.id));
    });

  const projectGone = !document?.nodes[projectId]?.project;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle>{t('share.title')}</DialogTitle>
          <DialogDescription>{t('share.description')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="text-muted-foreground">{t('share.include')}</span>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={includeDue} onChange={(e) => setIncludeDue(e.target.checked)} />
            {t('share.includeDates')}
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={includeStatus} onChange={(e) => setIncludeStatus(e.target.checked)} />
            {t('share.includeStatus')}
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={includeNotes} onChange={(e) => setIncludeNotes(e.target.checked)} />
            {t('share.includeNotes')}
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={!includeDone} onChange={(e) => setIncludeDone(!e.target.checked)} />
            {t('share.hideDone')}
          </label>
        </div>

        {privateCount > 0 && (
          <p className="text-xs text-muted-foreground">{t('share.privateCount', { count: privateCount })}</p>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">{t('share.loading')}</p>
        ) : share ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                readOnly
                aria-label={t('share.urlAria')}
                value={shareUrl(share.token)}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-md border border-input bg-muted/30 px-2 py-1.5 font-mono text-xs text-foreground outline-hidden focus:border-ring"
              />
              <Tooltip label={t('share.copyTooltip')}>
                <Button type="button" size="sm" variant="outline" onClick={() => copy(shareUrl(share.token))} className="gap-1.5">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? t('summary.copied') : t('summary.copy')}
                </Button>
              </Tooltip>
            </div>
            {dirty && <p className="text-xs text-muted-foreground">{t('share.dirtyHint')}</p>}
            {invisibleToGuests > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-500">{t('share.invisibleToGuests', { count: invisibleToGuests })}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('share.notPublished')}</p>
        )}

        {guestTicks > 0 && (
          <p className="text-xs text-muted-foreground">{t('share.guestTicks', { count: guestTicks })}</p>
        )}

        {suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t('share.fromGuests', { count: suggestions.length })}
            </p>
            {suggestions.length >= 400 && (
              <p role="alert" className="text-xs text-amber-600 dark:text-amber-500">
                {t('share.trayNearFull', { count: suggestions.length })}
              </p>
            )}
            <ul className="max-h-48 space-y-2 overflow-y-auto">
              {suggestions.map((sg) => (
                <li key={sg.id} className="rounded-md border border-border bg-card/50 p-2">
                  <p className="whitespace-pre-wrap text-sm text-foreground">{sg.body}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="mr-auto text-xs text-muted-foreground">
                      {sg.guest_name ?? t('share.suggestionAnonymous')} · {new Date(sg.created_at).toLocaleDateString()}
                    </span>
                    <button
                      type="button"
                      onClick={() => adopt(sg)}
                      disabled={busy}
                      className="rounded-md border border-input px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent disabled:opacity-50"
                    >
                      {t('share.toInbox')}
                    </button>
                    <button
                      type="button"
                      onClick={() => dismiss(sg)}
                      disabled={busy}
                      className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
                    >
                      {t('share.dismiss')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}

        <DialogFooter className="flex-wrap gap-2">
          {share && (
            <>
              <ConfirmButton
                aria-label={t('share.unpublishAria')}
                message={t('share.unpublishConfirm')}
                confirmLabel={t('share.unpublish')}
                onConfirm={unpublish}
                className="rounded-md border border-input px-3 py-1.5 text-sm font-medium text-destructive hover:bg-accent sm:mr-auto"
              >
                {t('share.unpublish')}
              </ConfirmButton>
              <ConfirmButton
                aria-label={t('share.rotateAria')}
                message={t('share.rotateConfirm')}
                confirmLabel={t('share.rotate')}
                destructive={false}
                onConfirm={rotate}
                className="rounded-md border border-input px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
              >
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" />
                  {t('share.rotate')}
                </span>
              </ConfirmButton>
            </>
          )}
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t('summary.close')}
          </Button>
          <Button type="button" disabled={busy || loading || projectGone} onClick={publish}>
            {share ? t('share.republish') : t('share.publish')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
