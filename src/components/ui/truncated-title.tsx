import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip } from './tooltip';

/**
 * One-line title that ellipsis-truncates to its container, and shows a tooltip with the **full
 * text only when it's actually clipped** — so you get the name back in tight spots (column cards,
 * narrow rows) without a redundant tooltip when the whole name already fits.
 *
 * Renders a block `<span>`; pass typography via `className`. Re-measures on container resize.
 */
export function TruncatedTitle({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setTruncated(el.scrollWidth > el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  const span = (
    <span ref={ref} className={cn('block truncate', className)}>
      {text}
    </span>
  );

  // Only arm the tooltip when the text is genuinely cut off.
  return truncated ? <Tooltip label={text}>{span}</Tooltip> : span;
}
