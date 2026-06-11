import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ActionRowData } from '../actions/rows';
import { TagFilterPanel } from './TagFilterPanel';

function row(id: string, title: string): ActionRowData {
  return { id, title, status: 'NEXT', path: [], tags: [], dueAt: null, touchedAt: null };
}

describe('TagFilterPanel', () => {
  it('shows the empty state with no tags', () => {
    render(<TagFilterPanel allTags={[]} selected={[]} rows={[]} onToggleTag={vi.fn()} onSetStatus={vi.fn()} />);
    expect(screen.getByText('No tags yet.')).toBeInTheDocument();
  });

  it('prompts to pick a tag when none are selected (no match flood)', () => {
    render(
      <TagFilterPanel
        allTags={['home', 'urgent']}
        selected={[]}
        rows={[]}
        onToggleTag={vi.fn()}
        onSetStatus={vi.fn()}
      />,
    );
    expect(screen.getByText('Select one or more tags to filter.')).toBeInTheDocument();
    expect(screen.queryByText(/match/)).not.toBeInTheDocument();
  });

  it('toggles tags and shows the match count', () => {
    const onToggleTag = vi.fn();
    render(
      <TagFilterPanel
        allTags={['home', 'urgent']}
        selected={['home']}
        rows={[row('a', 'Fix tap')]}
        onToggleTag={onToggleTag}
        onSetStatus={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'home' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('1 match')).toBeInTheDocument();
    expect(screen.getByText('Fix tap')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'urgent' }));
    expect(onToggleTag).toHaveBeenCalledWith('urgent');
  });
});
