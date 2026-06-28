import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NamNode } from '../../domain/types';
import { SettingsContext, type SettingsContextValue } from '@/components/settings/settings-context';
import { DEFAULT_DATE_FORMAT } from '@/lib/dates';
import { InboxPanel } from './InboxPanel';

function item(id: string, title: string): NamNode {
  return {
    id, title, description: null, status: 'BACKLOG', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null,
  };
}

function setup(items: NamNode[] = []) {
  const handlers = { onAdd: vi.fn(), onProcess: vi.fn(), onDelete: vi.fn() };
  render(<InboxPanel items={items} {...handlers} />);
  return handlers;
}

describe('InboxPanel', () => {
  it('shows the empty state with no items', () => {
    setup([]);
    expect(screen.getByText(/inbox zero/i)).toBeInTheDocument();
  });

  it('lists items', () => {
    setup([item('a', 'Buy milk'), item('b', 'Call Sam')]);
    expect(screen.getByText('Buy milk')).toBeInTheDocument();
    expect(screen.getByText('Call Sam')).toBeInTheDocument();
  });

  it('captures a trimmed title and clears the field', () => {
    const { onAdd } = setup();
    const input = screen.getByLabelText('Quick add');
    fireEvent.change(input, { target: { value: '  Buy milk  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAdd).toHaveBeenCalledWith('Buy milk');
    expect(input).toHaveValue('');
  });

  it('ignores empty/whitespace capture', () => {
    const { onAdd } = setup();
    fireEvent.change(screen.getByLabelText('Quick add'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAdd).not.toHaveBeenCalled();
  });

  it('Shift+Enter flips the add-position default and adds the item (#450)', () => {
    const onAdd = vi.fn();
    const setAddToBottom = vi.fn();
    const settings: SettingsContextValue = {
      dateFormat: DEFAULT_DATE_FORMAT,
      setDateFormat: vi.fn(),
      addToBottom: false,
      setAddToBottom,
      addToBottomDefault: false,
      setAddToBottomDefault: vi.fn(),
    };
    render(
      <SettingsContext.Provider value={settings}>
        <InboxPanel items={[]} onAdd={onAdd} onProcess={vi.fn()} onDelete={vi.fn()} />
      </SettingsContext.Provider>,
    );
    const input = screen.getByLabelText('Quick add');
    fireEvent.change(input, { target: { value: 'Buy milk' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(setAddToBottom).toHaveBeenCalledWith(true); // flipped from top (false) to bottom
    expect(onAdd).toHaveBeenCalledWith('Buy milk');
    expect(input).toHaveValue('');
  });

  it('plain Enter does not flip the add-position default', () => {
    const setAddToBottom = vi.fn();
    const settings: SettingsContextValue = {
      dateFormat: DEFAULT_DATE_FORMAT,
      setDateFormat: vi.fn(),
      addToBottom: false,
      setAddToBottom,
      addToBottomDefault: false,
      setAddToBottomDefault: vi.fn(),
    };
    render(
      <SettingsContext.Provider value={settings}>
        <InboxPanel items={[]} onAdd={vi.fn()} onProcess={vi.fn()} onDelete={vi.fn()} />
      </SettingsContext.Provider>,
    );
    const input = screen.getByLabelText('Quick add');
    fireEvent.change(input, { target: { value: 'Buy milk' } });
    fireEvent.keyDown(input, { key: 'Enter' }); // plain Enter — handled by the form submit
    expect(setAddToBottom).not.toHaveBeenCalled();
  });

  it('processes and deletes by id', () => {
    const { onProcess, onDelete } = setup([item('a', 'Buy milk')]);
    fireEvent.click(screen.getByRole('button', { name: 'Process Buy milk' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Buy milk' }));
    expect(onProcess).toHaveBeenCalledWith('a');
    expect(onDelete).toHaveBeenCalledWith('a');
  });

  it('offers a copy-name button on each inbox row', () => {
    setup([item('a', 'Buy milk')]);
    expect(screen.getByRole('button', { name: 'Copy name "Buy milk"' })).toBeInTheDocument();
  });

  it('pencil triggers inline rename (not an editor) and commits via onRename', () => {
    const onRename = vi.fn();
    render(
      <InboxPanel items={[item('a', 'Buy milk')]} onAdd={vi.fn()} onProcess={vi.fn()} onDelete={vi.fn()} onRename={onRename} />,
    );
    // The pencil opens the inline editor in-place rather than opening the action dialog.
    const pencil = screen.getByRole('button', { name: 'Rename Buy milk' });
    // It's a comfortable touch target on phones (coarse-pointer min size) — #411.
    expect(pencil.className).toContain('[@media(pointer:coarse)]:min-h-11');
    fireEvent.click(pencil);
    const input = screen.getByRole('textbox', { name: 'Rename Buy milk' });
    fireEvent.change(input, { target: { value: 'Buy oat milk' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('a', 'Buy oat milk');
  });
});
