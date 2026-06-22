import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ActionRowData } from '../actions/rows';
import type { SavedView } from '../../domain/types';
import { TagFilterPanel } from './TagFilterPanel';

function row(id: string, title: string): ActionRowData {
  return { id, title, status: 'NEXT', path: [], tags: [], dueAt: null, touchedAt: null };
}

function setup(over: Partial<React.ComponentProps<typeof TagFilterPanel>> = {}) {
  const handlers = {
    onToggleTag: vi.fn(), onToggleNextOnly: vi.fn(), onSetStatus: vi.fn(),
    onOpenView: vi.fn(), onRenameView: vi.fn(), onDeleteView: vi.fn(),
  };
  render(
    <TagFilterPanel
      allTags={['home', 'urgent']}
      selected={[]}
      nextOnly={false}
      rows={[]}
      savedViews={[]}
      {...handlers}
      {...over}
    />,
  );
  return handlers;
}

describe('TagFilterPanel', () => {
  it('shows the empty state with no tags', () => {
    setup({ allTags: [] });
    expect(screen.getByText('No tags yet')).toBeInTheDocument();
  });

  it('prompts to pick a tag when none are selected (no match flood)', () => {
    setup({ selected: [], rows: [] });
    expect(screen.getByText(/Select a tag to filter/)).toBeInTheDocument();
    expect(screen.queryByText(/match/)).not.toBeInTheDocument();
  });

  it('offers a Focus button over the filtered results', () => {
    const onFocus = vi.fn();
    setup({ selected: ['home'], rows: [row('a', 'Tidy desk')], onFocus });
    fireEvent.click(screen.getByRole('button', { name: 'Focus' }));
    expect(onFocus).toHaveBeenCalled();
  });

  it('hides Focus when the filter has no matches', () => {
    setup({ selected: ['home'], rows: [], onFocus: vi.fn() });
    expect(screen.queryByRole('button', { name: 'Focus' })).not.toBeInTheDocument();
  });

  it('toggles tags and shows the match count', () => {
    const { onToggleTag } = setup({ selected: ['home'], rows: [row('a', 'Fix tap')] });
    expect(screen.getByRole('button', { name: 'home' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('1 match')).toBeInTheDocument();
    expect(screen.getByText('Fix tap')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'urgent' }));
    expect(onToggleTag).toHaveBeenCalledWith('urgent');
  });

  it('opens and deletes a saved view', () => {
    const view: SavedView = { name: 'Errands', tags: ['home'], nextOnly: true };
    const { onOpenView, onDeleteView } = setup({ savedViews: [view] });
    expect(screen.getByText('Saved views')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open view Errands' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete view Errands' }));
    expect(onOpenView).toHaveBeenCalledWith(view);
    expect(onDeleteView).toHaveBeenCalledWith('Errands');
  });

  it('keeps the manage section collapsed by default, expandable via the disclosure', () => {
    const onAddTag = vi.fn();
    setup({ allTags: [], onAddTag });
    // Collapsed: the create input is hidden until you expand "Manage tags".
    expect(screen.queryByLabelText('Create tag')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Manage tags/ }));
    expect(screen.getByLabelText('Create tag')).toBeInTheDocument();
  });

  it('creates a tag via the input and clears it (even with no tags yet)', () => {
    const onAddTag = vi.fn();
    setup({ allTags: [], onAddTag });
    fireEvent.click(screen.getByRole('button', { name: /Manage tags/ }));
    const input = screen.getByLabelText('Create tag');
    fireEvent.change(input, { target: { value: '@phone' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAddTag).toHaveBeenCalledWith('@phone');
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('has no manage section at all when no manage handlers are provided', () => {
    setup();
    expect(screen.queryByRole('button', { name: /Manage tags/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Create tag')).not.toBeInTheDocument();
  });

  it('renames a tag via the anchored prompt popover (once expanded)', () => {
    const onRenameTag = vi.fn();
    setup({ allTags: ['home'], tagCounts: { home: 3 }, onRenameTag });
    fireEvent.click(screen.getByRole('button', { name: /Manage tags/ }));
    expect(screen.getByText('3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rename tag home' }));
    const input = screen.getByLabelText('New tag name'); // prefilled with the current name
    fireEvent.change(input, { target: { value: 'house' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    expect(onRenameTag).toHaveBeenCalledWith('home', 'house');
  });

  it('deletes a tag via the anchored confirm popover (once expanded)', () => {
    const onDeleteTag = vi.fn();
    setup({ allTags: ['home'], tagCounts: { home: 3 }, onDeleteTag });
    fireEvent.click(screen.getByRole('button', { name: /Manage tags/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete tag home' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDeleteTag).toHaveBeenCalledWith('home');
  });
});
