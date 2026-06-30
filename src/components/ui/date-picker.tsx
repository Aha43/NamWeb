import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

// A small, dependency-free month calendar — for *seeing* what weekday a date lands on while planning.
// Type-in (yy-mm-dd) stays the primary path; this is an additive affordance (#499). Monday-first.

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** The calendar grid itself (no popover) — exported for testing. */
export function CalendarGrid({
  selected,
  onSelect,
  today = new Date(),
}: {
  selected: string | null;
  onSelect: (isoDate: string) => void;
  today?: Date;
}) {
  const seed =
    selected && /^\d{4}-\d{2}-\d{2}$/.test(selected)
      ? { y: Number(selected.slice(0, 4)), m: Number(selected.slice(5, 7)) - 1 }
      : { y: today.getFullYear(), m: today.getMonth() };
  const [view, setView] = useState(seed);

  const firstWeekday = (new Date(view.y, view.m, 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const todayIso = iso(today.getFullYear(), today.getMonth(), today.getDate());

  const step = (delta: number) => {
    const d = new Date(view.y, view.m + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };

  return (
    <div className="w-60">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label="Previous month" onClick={() => step(-1)}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium">{MONTHS[view.m]} {view.y}</span>
        <button type="button" aria-label="Next month" onClick={() => step(1)}
          className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] text-muted-foreground">
        {WEEKDAYS.map((w) => (
          <span key={w} className="py-1">{w}</span>
        ))}
        {Array.from({ length: firstWeekday }, (_, i) => <span key={`b${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const dayIso = iso(view.y, view.m, day);
          const isSelected = dayIso === selected;
          const isToday = dayIso === todayIso;
          return (
            <button
              key={day}
              type="button"
              aria-label={dayIso}
              aria-pressed={isSelected}
              onClick={() => onSelect(dayIso)}
              className={cn(
                'rounded-md py-1 text-sm text-foreground hover:bg-accent',
                isSelected && 'bg-primary text-primary-foreground hover:bg-primary/90',
                !isSelected && isToday && 'ring-1 ring-ring',
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** A calendar icon button that opens the grid in a popover; picking a day fills the bound input. */
export function DatePickerPopover({
  value,
  onSelect,
  label = 'Pick a date from a calendar',
}: {
  value: string | null;
  onSelect: (isoDate: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="shrink-0 rounded-md border border-input p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <CalendarDays className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end">
        <CalendarGrid
          selected={value}
          onSelect={(isoDate) => {
            onSelect(isoDate);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
