import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { buttonVariants } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { TOUCH_TARGET } from './touch';

const COARSE = '[@media(pointer:coarse)]:min-h-11';

describe('touch targets', () => {
  it('the icon Button variant carries a coarse-pointer min size', () => {
    expect(buttonVariants({ size: 'icon' })).toContain(COARSE);
  });

  it('CopyButton applies the touch-target minimum', () => {
    render(<CopyButton value="x" label="thing" />);
    const btn = screen.getByRole('button', { name: 'Copy thing' });
    // The shared constant is present (so coarse-pointer devices get a ~44px hit area).
    for (const cls of TOUCH_TARGET.split(' ')) expect(btn.className).toContain(cls);
  });
});
