import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LogoMark } from './LogoMark';

describe('LogoMark', () => {
  // Radix `Tooltip` wraps the mark with `Trigger asChild`, which works by cloning its
  // handlers + ref onto this element — if LogoMark drops them, the brand/version tooltip
  // on the logo is silently dead (#616).
  it('forwards rest props and ref to the svg (the Tooltip-trigger contract)', () => {
    const onPointerEnter = vi.fn();
    const ref = createRef<SVGSVGElement>();
    render(<LogoMark data-testid="logo" onPointerEnter={onPointerEnter} ref={ref} />);
    const svg = screen.getByTestId('logo');
    expect(ref.current).toBe(svg);
    fireEvent.pointerEnter(svg);
    expect(onPointerEnter).toHaveBeenCalledOnce();
  });

  it('keeps its accessible name and className', () => {
    render(<LogoMark className="h-7 w-7" />);
    const svg = screen.getByRole('img', { name: 'Next Action Master' });
    expect(svg).toHaveClass('h-7', 'w-7');
  });
});
