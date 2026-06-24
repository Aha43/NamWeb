import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DemoApp } from './DemoApp';

describe('DemoApp', () => {
  beforeEach(() => localStorage.clear());

  it('mounts the full app with no account and shows the demo banner', () => {
    render(<DemoApp onSignUp={vi.fn()} />);
    // The whole tree (providers + routes + shell) mounts with a synthetic user and seeded local doc.
    expect(screen.getByText(/you're in a demo/i)).toBeInTheDocument();
  });
});
