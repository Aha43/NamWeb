import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NamNode } from '../../domain/types';
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

  it('bulk-triages selected items with one shared resolution (#458)', () => {
    const onBulkResolve = vi.fn();
    render(
      <InboxPanel
        items={[item('a', 'Buy milk'), item('b', 'Call Sam')]}
        onAdd={vi.fn()}
        onProcess={vi.fn()}
        onDelete={vi.fn()}
        onBulkResolve={onBulkResolve}
      />,
    );
    // No bulk bar until you enter select mode.
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Select items' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    // The wizard (#641): Process… → Next (default destination preselected) → choose → Done.
    fireEvent.click(screen.getByRole('button', { name: 'Process…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' })); // destination step footer
    fireEvent.click(screen.getByRole('button', { name: 'Next' })); // the status option (footer has Back/Done)
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onBulkResolve).toHaveBeenCalledWith(['a', 'b'], { kind: 'action', status: 'NEXT', parentId: undefined });
    // The wizard folded away; the selection was cleared.
    expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument();
    expect(screen.getByText('0 selected')).toBeInTheDocument();
  });

  it('row action icons carry hover tooltips on desktop (#543; phone hides them behind "…", #782)', async () => {
    // Tooltips are a hover concern — force the desktop branch (jsdom defaults to phone).
    const original = window.matchMedia;
    window.matchMedia = ((query: string) =>
      ({ matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {} })
    ) as unknown as typeof window.matchMedia;
    try {
      render(
        <InboxPanel
          items={[item('a', 'Buy milk')]}
          onAdd={vi.fn()}
          onProcess={vi.fn()}
          onDelete={vi.fn()}
          onRename={vi.fn()}
          onBulkResolve={vi.fn()}
        />,
      );
      fireEvent.focus(screen.getByRole('button', { name: 'Delete Buy milk' }));
      expect(await screen.findByRole('tooltip')).toHaveTextContent('Delete Buy milk');
    } finally {
      window.matchMedia = original;
    }
  });

  it('phone: copy/rename/delete hide behind the per-row "…"; Process stays out (#782)', () => {
    const onDelete = vi.fn();
    render(
      <InboxPanel
        items={[item('a', 'Buy milk')]}
        onAdd={vi.fn()}
        onProcess={vi.fn()}
        onDelete={onDelete}
        onRename={vi.fn()}
        onBulkResolve={vi.fn()}
      />,
    );
    // Process is the primary verb — always visible.
    expect(screen.getByRole('button', { name: 'Process Buy milk' })).toBeInTheDocument();
    // The secondary strip is hidden until revealed.
    expect(screen.getByRole('button', { name: 'Delete Buy milk' }).parentElement).toHaveClass('hidden');
    fireEvent.click(screen.getByRole('button', { name: 'Show actions for Buy milk' }));
    expect(screen.getByRole('button', { name: 'Delete Buy milk' }).parentElement).not.toHaveClass('hidden');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Buy milk' }));
    expect(onDelete).toHaveBeenCalledWith('a');
  });

  it('the "…" stays rendered (disabled) during a rename — layout frozen across blur-commit (#786/F2)', () => {
    render(
      <InboxPanel
        items={[item('a', 'Buy milk')]}
        onAdd={vi.fn()}
        onProcess={vi.fn()}
        onDelete={vi.fn()}
        onRename={vi.fn()}
        onBulkResolve={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show actions for Buy milk' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rename Buy milk' }));
    const reveal = screen.getByRole('button', { name: 'Show actions for Buy milk' });
    expect(reveal).toBeInTheDocument(); // not unmounted — no reflow under the ending tap
    expect(reveal).toBeDisabled();
  });

  it('entering select mode closes an open "…" strip (#786/Q5)', () => {
    render(
      <InboxPanel
        items={[item('a', 'Buy milk')]}
        onAdd={vi.fn()}
        onProcess={vi.fn()}
        onDelete={vi.fn()}
        onRename={vi.fn()}
        onBulkResolve={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show actions for Buy milk' }));
    fireEvent.click(screen.getByRole('button', { name: 'Select items' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exit select' }));
    // Back out of select mode: the strip did not survive the round-trip.
    expect(screen.getByRole('button', { name: 'Show actions for Buy milk' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('the mobile checkmark (blur) SAVES an inline edit (#782)', () => {
    const onRename = vi.fn();
    render(
      <InboxPanel
        items={[item('a', 'Buy milk')]}
        onAdd={vi.fn()}
        onProcess={vi.fn()}
        onDelete={vi.fn()}
        onRename={onRename}
        onBulkResolve={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Show actions for Buy milk' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rename Buy milk' }));
    const input = screen.getByRole('textbox', { name: 'Rename Buy milk' }); // the pencil shares the label, hidden in the collapsed strip
    fireEvent.change(input, { target: { value: 'Buy oat milk' } });
    fireEvent.blur(input); // what the phone keyboard's ✓ actually does
    expect(onRename).toHaveBeenCalledWith('a', 'Buy oat milk');
  });

  it('Process button scopes to the selection and exits select mode (#648)', () => {
    const onProcessAll = vi.fn();
    render(
      <InboxPanel
        items={[item('a', 'Buy milk'), item('b', 'Call Sam'), item('c', 'Read mail')]}
        onAdd={vi.fn()}
        onProcess={vi.fn()}
        onDelete={vi.fn()}
        onBulkResolve={vi.fn()}
        onProcessAll={onProcessAll}
      />,
    );
    expect(screen.getByRole('button', { name: /Process inbox \(3\)/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Select items' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Read mail' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Buy milk' }));
    const scoped = screen.getByRole('button', { name: /Process selected \(2\)/ });
    fireEvent.click(scoped);
    // Ids in list order (not tick order); select mode exited as the deck takes over.
    expect(onProcessAll).toHaveBeenCalledWith(['a', 'c']);
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
  });

  it('hides the select toggle when bulk is not supported', () => {
    setup([item('a', 'Buy milk')]);
    expect(screen.queryByRole('button', { name: 'Select items' })).not.toBeInTheDocument();
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
