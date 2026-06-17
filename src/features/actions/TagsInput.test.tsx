import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TagsInput } from './TagsInput';

const SUGGESTIONS = ['@phone', '@home', '@errand', 'urgent'];

/** Controlled wrapper so we can drive value changes like the real dialog does. */
function Harness({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <TagsInput id="t" value={value} onChange={setValue} suggestions={SUGGESTIONS} />
      <output data-testid="val">{value}</output>
    </>
  );
}

describe('TagsInput', () => {
  it('suggests existing tags matching the current token on focus', () => {
    render(<Harness initial="@h" />);
    fireEvent.focus(screen.getByRole('combobox'));
    expect(screen.getByRole('option', { name: '@home' })).toBeInTheDocument();
    // '@phone' doesn't match '@h'
    expect(screen.queryByRole('option', { name: '@phone' })).not.toBeInTheDocument();
  });

  it('applies a clicked suggestion (appended, ready for the next)', () => {
    render(<Harness initial="@h" />);
    fireEvent.focus(screen.getByRole('combobox'));
    fireEvent.mouseDown(screen.getByRole('option', { name: '@home' }));
    expect(screen.getByTestId('val').textContent).toBe('@home, ');
  });

  it('excludes already-entered tags from suggestions', () => {
    render(<Harness initial="@home, @" />);
    fireEvent.focus(screen.getByRole('combobox'));
    expect(screen.queryByRole('option', { name: '@home' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: '@phone' })).toBeInTheDocument();
  });

  it('shows no dropdown when nothing matches', () => {
    render(<Harness initial="zzz" />);
    fireEvent.focus(screen.getByRole('combobox'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
