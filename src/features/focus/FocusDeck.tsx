import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, FolderInput, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { CopyButton } from '@/components/ui/copy-button';
import { InProgressToggle } from '@/features/tags/InProgressToggle';
import { Tooltip } from '@/components/ui/tooltip';
import { InlineRename } from '../actions/InlineRename';
import { useHasKeyboard } from '@/shell/useHasKeyboard';
import { isModalOpen } from '@/shell/useGlobalShortcuts';
import type { FocusCard } from './focusCards';

/** Id on the current card's delete trigger, so the `Delete` key can open its confirm popover. */
const DELETE_TRIGGER_ID = 'focus-delete-trigger';

export interface FocusDeckProps {
  cards: FocusCard[];
  onDone: (id: string) => void;
  onExit: () => void;
  /**
   * Optional in-flow re-triage: move the current card to the other queue (Next↔Backlog). When
   * wired, a secondary button appears; flipping changes the card's status, so it drops out of this
   * deck and the next card slides in — exactly like Done. `flipLabel` is the destination ("Backlog"
   * / "Next"). Omitted for project-scoped focus (mixed statuses).
   */
  flipLabel?: string;
  onFlip?: (id: string) => void;
  /** Small per-card controls (don't disrupt the deck): open the editor, rename inline, delete. */
  onEditCard?: (id: string) => void;
  onRenameCard?: (id: string, title: string) => void;
  onDeleteCard?: (id: string) => void;
  /** Label for the primary advance action. Omit for the default ("Done"); Done-focus passes e.g. "To Next". */
  doneLabel?: string;
}

/**
 * One-card-at-a-time execution deck (NamDesktop focus mode). Circular prev/next,
 * Done & advance, keyboard (←/→/Space/Esc), and swipe on touch. The card list is
 * live — marking Done (or re-triaging) removes the item upstream and the next card slides in.
 */
export function FocusDeck({
  cards,
  onDone,
  onExit,
  flipLabel,
  onFlip,
  onEditCard,
  onRenameCard,
  onDeleteCard,
  doneLabel,
}: FocusDeckProps) {
  const { t } = useTranslation();
  const doneText = doneLabel ?? t('domain.status.done');
  const doneAria = doneLabel ?? t('focus.markDone');
  // The deck position pins the current card by id, not raw index: the card list is live, and a
  // background removal (a sync pull, a done/undo on another surface) shifts indices — an
  // index-only position would swap the card under the pointer right before a click or keypress
  // (#614). The stored index is the fallback for when the pinned card itself leaves the deck
  // (Done/flip/delete): the next card slides into its slot, as before.
  const [position, setPosition] = useState<{ id: string | null; index: number }>({ id: null, index: 0 });
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  const hasKeyboard = useHasKeyboard();

  const len = cards.length;
  const pinnedIndex = position.id === null ? -1 : cards.findIndex((c) => c.id === position.id);
  const rawIndex = pinnedIndex >= 0 ? pinnedIndex : position.index;
  const safeIndex = len === 0 ? 0 : ((rawIndex % len) + len) % len;
  const current = cards[safeIndex];
  // Pin whatever card is showing (adjust-during-render): establishes the pin on first render,
  // tracks the pinned card's live slot, and re-attaches to the slid-in card after a fallback.
  if (current && (position.id !== current.id || position.index !== safeIndex)) {
    setPosition({ id: current.id, index: safeIndex });
  }

  const moveBy = (delta: number) => {
    if (len === 0) return;
    const target = (((safeIndex + delta) % len) + len) % len;
    setPosition({ id: cards[target].id, index: target });
  };
  const next = () => moveBy(1);
  const prev = () => moveBy(-1);
  const done = () => {
    if (current) onDone(current.id);
  };
  const flip = () => {
    if (current && onFlip) onFlip(current.id);
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't hijack keys while typing in the inline rename field (Space/arrows are text there).
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      // A modal (the action editor, confirm dialogs…) owns the keys — with dialog focus on a
      // button, `e` would swap the open editor to another card and Space would mark the deck's
      // card done *behind* the dialog (#614). Same guard as the global shortcuts (#486).
      if (isModalOpen()) return;
      // Leave Ctrl/Cmd/Alt combos to the browser/OS (and the editor's Cmd+Enter).
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === ' ') {
        // Space keeps its native meaning on a focused control (Rename/Delete/Copy, nav buttons…):
        // intercepting there would mark the card Done instead of activating the button (#628).
        // (instanceof: the target can be window/document when nothing focused.)
        if (t instanceof Element && t.closest('button, a, [role="button"], input, select, [contenteditable="true"]')) return;
        e.preventDefault();
        done();
      } else if (e.key === 'Escape') onExit();
      // Per-card actions, only when wired (no-op otherwise — e.g. project-scoped focus has no flip).
      // preventDefault: these open an autofocused input (editor title, inline rename) — without it
      // the keystroke's own text insertion lands in that field (#614).
      else if ((e.key === 'e' || e.key === 'E') && onEditCard && current) {
        e.preventDefault();
        onEditCard(current.id);
      } else if ((e.key === 'r' || e.key === 'R') && onRenameCard && current) {
        e.preventDefault();
        setRenamingId(current.id);
      } else if ((e.key === 'f' || e.key === 'F') && onFlip && current) flip();
      else if (e.key === 'Delete' && onDeleteCard) {
        // Reuse the card's confirm popover (autofocused confirm, Enter/Esc) rather than deleting outright.
        document.getElementById(DELETE_TRIGGER_ID)?.click();
      }
    }
    // CAPTURE phase, so the isModalOpen() check runs before Radix dismisses its layer — in the
    // bubble phase an Escape aimed at the dialog would find it already closed and exit Focus too
    // (the #608 Escape-layering gotcha).
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
    // Re-bind so the handlers close over the current card/position.
  }, [cards, position]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard hint, reflecting which per-card actions are wired in this deck.
  const keyboardHint = [
    t('focus.hintMove'),
    t('focus.hintDone'),
    onEditCard && t('focus.hintEdit'),
    onRenameCard && t('focus.hintRename'),
    onFlip && flipLabel && t('focus.hintFlip', { label: flipLabel }),
    onDeleteCard && t('focus.hintDelete'),
    t('focus.hintExit'),
  ]
    .filter(Boolean)
    .join(' · ');

  if (!current) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-lg font-medium text-foreground">{t('focus.allClear')}</p>
        <p className="max-w-xs text-sm text-muted-foreground">{t('focus.allClearHint')}</p>
        <Button variant="outline" onClick={onExit}>
          {t('focus.allClearButton')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 items-center justify-center px-6 py-8">
        <motion.div
          key={current.id}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.4}
          onDragEnd={(_, info) => {
            if (info.offset.x < -80) next();
            else if (info.offset.x > 80) prev();
          }}
          initial={reduceMotion ? false : { opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.15 }}
          className="w-full max-w-lg cursor-grab rounded-2xl border border-border bg-card p-8 shadow-xs active:cursor-grabbing"
        >
          {(onEditCard || onRenameCard || onDeleteCard) && (
            <div className="mb-3 flex items-center justify-end gap-1">
              {onRenameCard && renamingId !== current.id && (
                <Tooltip label={t('common.rename')}>
                  <button
                    type="button"
                    aria-label={t('actions.renameAria', { title: current.title })}
                    onClick={() => setRenamingId(current.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </Tooltip>
              )}
              <InProgressToggle id={current.id} title={current.title} />
              <CopyButton value={current.title} label={t('copy.name', { title: current.title })} />
              {onDeleteCard && (
                <ConfirmButton
                  id={DELETE_TRIGGER_ID}
                  aria-label={t('actions.deleteAria', { title: current.title })}
                  message={t('focus.deleteConfirm', { title: current.title })}
                  onConfirm={() => onDeleteCard(current.id)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </ConfirmButton>
              )}
            </div>
          )}
          {current.path.length > 0 && (
            <p className="mb-2 text-sm text-muted-foreground">{current.path.join(' › ')}</p>
          )}
          {onRenameCard && renamingId === current.id ? (
            <InlineRename
              title={current.title}
              onCommit={(t) => {
                onRenameCard(current.id, t);
                setRenamingId(null);
              }}
              onCancel={() => setRenamingId(null)}
            />
          ) : onEditCard ? (
            <button
              type="button"
              aria-label={t('actions.editAria', { title: current.title })}
              onClick={() => onEditCard(current.id)}
              className="block w-full text-left"
            >
              <h2 className="text-2xl font-semibold leading-snug text-card-foreground">{current.title}</h2>
            </button>
          ) : (
            <h2 className="text-2xl font-semibold leading-snug text-card-foreground">{current.title}</h2>
          )}
          {current.description && (
            <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">{current.description}</p>
          )}
        </motion.div>
      </div>

      <div className="flex items-center justify-center gap-4 px-6 pb-10">
        <Button variant="outline" size="icon" aria-label={t('focus.previous')} onClick={prev}>
          <ChevronLeft />
        </Button>
        <Button size="lg" className="gap-2 px-8" aria-label={doneAria} onClick={done}>
          <Check />
          {doneText}
        </Button>
        <Button variant="outline" size="icon" aria-label={t('focus.next')} onClick={next}>
          <ChevronRight />
        </Button>
      </div>

      {onFlip && flipLabel && (
        <div className="flex justify-center pb-4">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            aria-label={t('focus.moveTo', { label: flipLabel })}
            onClick={flip}
          >
            <FolderInput className="h-4 w-4" />
            {t('focus.moveTo', { label: flipLabel })}
          </Button>
        </div>
      )}

      <p className="text-center text-sm text-muted-foreground" aria-label={t('focus.progress')} aria-live="polite">
        {safeIndex + 1} / {len}
      </p>
      <p className="pb-6 pt-1 text-center text-xs text-muted-foreground/70">
        {hasKeyboard ? keyboardHint : t('focus.touchHint')}
      </p>
    </div>
  );
}
