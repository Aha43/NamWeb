import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FocusCard } from './focusCards';

export interface FocusDeckProps {
  cards: FocusCard[];
  onDone: (id: string) => void;
  onExit: () => void;
}

/**
 * One-card-at-a-time execution deck (NamDesktop focus mode). Circular prev/next,
 * Done & advance, keyboard (←/→/Space/Esc), and swipe on touch. The card list is
 * live — marking Done removes the item upstream and the next card slides in.
 */
export function FocusDeck({ cards, onDone, onExit }: FocusDeckProps) {
  const [index, setIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  const len = cards.length;
  const safeIndex = len === 0 ? 0 : ((index % len) + len) % len;
  const current = cards[safeIndex];

  const next = () => setIndex((i) => i + 1);
  const prev = () => setIndex((i) => i - 1);
  const done = () => {
    if (current) onDone(current.id);
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === ' ') {
        e.preventDefault();
        done();
      } else if (e.key === 'Escape') onExit();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // Re-bind so the handlers close over the current card/index.
  }, [cards, index]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!current) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-lg font-medium text-foreground">All done.</p>
        <p className="text-sm text-muted-foreground">Nothing left in this queue.</p>
        <Button variant="outline" onClick={onExit}>
          Done
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
          {current.path.length > 0 && (
            <p className="mb-2 text-sm text-muted-foreground">{current.path.join(' › ')}</p>
          )}
          <h2 className="text-2xl font-semibold leading-snug text-card-foreground">{current.title}</h2>
          {current.description && (
            <p className="mt-4 whitespace-pre-wrap text-sm text-muted-foreground">{current.description}</p>
          )}
        </motion.div>
      </div>

      <div className="flex items-center justify-center gap-4 px-6 pb-10">
        <Button variant="outline" size="icon" aria-label="Previous" onClick={prev}>
          <ChevronLeft />
        </Button>
        <Button size="lg" className="gap-2 px-8" aria-label="Mark done" onClick={done}>
          <Check />
          Done
        </Button>
        <Button variant="outline" size="icon" aria-label="Next" onClick={next}>
          <ChevronRight />
        </Button>
      </div>

      <p className="pb-6 text-center text-sm text-muted-foreground" aria-label="Progress" aria-live="polite">
        {safeIndex + 1} / {len}
      </p>
    </div>
  );
}
