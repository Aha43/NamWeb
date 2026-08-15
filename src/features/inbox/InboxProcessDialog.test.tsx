import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NamNode } from '@/domain/types';
import { InboxProcessDialog, type ProjectTarget } from './InboxProcessDialog';

function node(): NamNode {
  return {
    id: 'a', title: 'Plan trip', description: null, status: 'BACKLOG', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null,
  };
}

const targets: ProjectTarget[] = [
  { id: 'p1', label: 'Kitchen Reno' },
  { id: 'p2', label: 'Kitchen Reno › Tiling' },
];

describe('InboxProcessDialog', () => {
  it('resolves to a top-level project via the make-project brain-dump (#1007)', () => {
    const onResolve = vi.fn();
    render(<InboxProcessDialog node={node()} open onOpenChange={vi.fn()} onResolve={onResolve} />);
    fireEvent.click(screen.getByRole('button', { name: /make a project/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Make project' })); // opens the brain-dump
    // Create & keep processing → openAfter=false; the item title is the default project name.
    fireEvent.click(screen.getByRole('button', { name: 'Create & keep processing' }));
    expect(onResolve).toHaveBeenCalledWith({
      kind: 'project',
      parentId: undefined,
      projectTitle: 'Plan trip',
      actionNames: [],
      openAfter: false,
      tags: undefined,
    });
  });

  it('resolves to an action with the chosen status', () => {
    const onResolve = vi.fn();
    render(<InboxProcessDialog node={node()} open onOpenChange={vi.fn()} onResolve={onResolve} />);
    fireEvent.click(screen.getByRole('button', { name: /one action/i }));
    fireEvent.click(screen.getByRole('button', { name: /park for later/i }));
    expect(onResolve).toHaveBeenCalledWith({ kind: 'action', status: 'BACKLOG', parentId: undefined });
  });

  it('files an action under a chosen project', () => {
    const onResolve = vi.fn();
    render(
      <InboxProcessDialog node={node()} open onOpenChange={vi.fn()} onResolve={onResolve} projectTargets={targets} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /one action/i }));
    fireEvent.change(screen.getByRole('combobox', { name: 'File under' }), { target: { value: 'p1' } });
    fireEvent.click(screen.getByRole('button', { name: /do it next/i }));
    expect(onResolve).toHaveBeenCalledWith({ kind: 'action', status: 'NEXT', parentId: 'p1' });
  });

  it('nests a new project under a chosen project', () => {
    const onResolve = vi.fn();
    render(
      <InboxProcessDialog node={node()} open onOpenChange={vi.fn()} onResolve={onResolve} projectTargets={targets} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /make a project/i }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Nest under' }), { target: { value: 'p2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Make project' }));
    // Seed a first action, then Create & open project → openAfter=true, nested under p2.
    const addInput = screen.getByLabelText('Add an action');
    fireEvent.change(addInput, { target: { value: 'Sketch layout' } });
    fireEvent.keyDown(addInput, { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'Create & open project' }));
    expect(onResolve).toHaveBeenCalledWith({
      kind: 'project',
      parentId: 'p2',
      projectTitle: 'Plan trip',
      actionNames: ['Sketch layout'],
      openAfter: true,
      tags: undefined,
    });
  });

  it('omits the picker when there are no projects yet', () => {
    render(<InboxProcessDialog node={node()} open onOpenChange={vi.fn()} onResolve={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /one action/i }));
    expect(screen.queryByRole('combobox', { name: 'File under' })).not.toBeInTheDocument();
  });

  it('deck mode shows the "X of N" position + chevron nav / Delete and does not self-close on resolve (#988)', () => {
    const onOpenChange = vi.fn();
    const onDelete = vi.fn();
    const onSkip = vi.fn();
    const onPrev = vi.fn();
    const onResolve = vi.fn();
    render(
      <InboxProcessDialog
        node={node()}
        open
        onOpenChange={onOpenChange}
        onResolve={onResolve}
        onDelete={onDelete}
        onSkip={onSkip}
        onPrev={onPrev}
        remaining={3}
        position={2}
      />,
    );
    expect(screen.getByText(/2 of 3/)).toBeInTheDocument();
    // Chevron nav (no "Skip"/"Prev" wording) flanks a centered Delete, like the Focus deck.
    fireEvent.click(screen.getByRole('button', { name: 'Next item' }));
    expect(onSkip).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous item' }));
    expect(onPrev).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalled();
    // Resolving in deck mode advances via the parent — it must NOT close the dialog itself.
    fireEvent.click(screen.getByRole('button', { name: /make a project/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Make project' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create & keep processing' }));
    expect(onResolve).toHaveBeenCalledWith({
      kind: 'project',
      parentId: undefined,
      projectTitle: 'Plan trip',
      actionNames: [],
      openAfter: false,
      tags: undefined,
    });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('deck mode cycles the item with the ←/→ arrow keys, even when focus is outside the dialog (#882)', () => {
    const onSkip = vi.fn();
    const onPrev = vi.fn();
    render(
      <InboxProcessDialog
        node={node()}
        open
        onOpenChange={vi.fn()}
        onResolve={vi.fn()}
        onDelete={vi.fn()}
        onSkip={onSkip}
        onPrev={onPrev}
        remaining={3}
        position={1}
      />,
    );
    // Fire on document.body — the regression: focus need NOT be inside the dialog (Safari + Full
    // Keyboard Access off lands the keydown here). A window listener still catches it.
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(onSkip).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(onPrev).toHaveBeenCalledTimes(1);
    // A modifier combo is left to the browser/OS.
    fireEvent.keyDown(document.body, { key: 'ArrowRight', metaKey: true });
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('the make-project brain-dump suppresses the deck ←/→ nav (#1007 review)', () => {
    const onSkip = vi.fn();
    const onPrev = vi.fn();
    render(
      <InboxProcessDialog
        node={node()}
        open
        onOpenChange={vi.fn()}
        onResolve={vi.fn()}
        onDelete={vi.fn()}
        onSkip={onSkip}
        onPrev={onPrev}
        remaining={3}
        position={1}
      />,
    );
    // Open the nested brain-dump (a layer on top).
    fireEvent.click(screen.getByRole('button', { name: /make a project/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Make project' }));
    // ←/→ must NOT advance the inbox deck underneath while the brain-dump owns the keys.
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(onSkip).not.toHaveBeenCalled();
    expect(onPrev).not.toHaveBeenCalled();
  });

  it('deck mode: quick-capture adds a new inbox item without leaving the deck, and `c` focuses it (#1119)', () => {
    const onCapture = vi.fn();
    render(
      <InboxProcessDialog
        node={node()}
        open
        onOpenChange={vi.fn()}
        onResolve={vi.fn()}
        onDelete={vi.fn()}
        onSkip={vi.fn()}
        onPrev={vi.fn()}
        onCapture={onCapture}
        remaining={3}
        position={1}
      />,
    );
    const field = screen.getByLabelText('Capture another inbox item');
    // `c` fired outside a field focuses the capture input — mirrors the global shortcut this modal suppresses.
    expect(field).not.toHaveFocus();
    fireEvent.keyDown(document.body, { key: 'c' });
    expect(field).toHaveFocus();
    // A remembered thought → trimmed, dispatched to the inbox, field cleared + refocused, confirmation shown.
    fireEvent.change(field, { target: { value: '  Call the vet  ' } });
    fireEvent.submit(field.closest('form')!);
    expect(onCapture).toHaveBeenCalledWith('Call the vet');
    expect(field).toHaveValue('');
    expect(field).toHaveFocus();
    expect(screen.getByText('Just added')).toBeInTheDocument();
  });

  it('`c` does not steal the key while typing in a deck field (only focuses capture from outside) (#1119)', () => {
    const onCapture = vi.fn();
    render(
      <InboxProcessDialog
        node={node()}
        open
        onOpenChange={vi.fn()}
        onResolve={vi.fn()}
        onDelete={vi.fn()}
        onSkip={vi.fn()}
        onPrev={vi.fn()}
        onCapture={onCapture}
        remaining={2}
        position={1}
      />,
    );
    const field = screen.getByLabelText('Capture another inbox item');
    // Typing 'c' INTO the field must not preventDefault / re-focus-hijack — the target-is-input guard bails.
    fireEvent.keyDown(field, { key: 'c' });
    // (No assertion on value — jsdom keyDown doesn't type; the point is the handler bailed, not throwing.)
    expect(onCapture).not.toHaveBeenCalled();
  });

  it('no quick-capture field when onCapture is not wired', () => {
    render(
      <InboxProcessDialog
        node={node()}
        open
        onOpenChange={vi.fn()}
        onResolve={vi.fn()}
        onDelete={vi.fn()}
        onSkip={vi.fn()}
        remaining={2}
        position={1}
      />,
    );
    expect(screen.queryByLabelText('Capture another inbox item')).not.toBeInTheDocument();
  });

  it('deck arrows fire in the capture phase, surviving a bubble-phase stopPropagation (#885)', () => {
    const onSkip = vi.fn();
    render(
      <InboxProcessDialog
        node={node()}
        open
        onOpenChange={vi.fn()}
        onResolve={vi.fn()}
        onDelete={vi.fn()}
        onSkip={onSkip}
        onPrev={vi.fn()}
        remaining={2}
        position={1}
      />,
    );
    // Mimic the real failure: something in the dialog path swallows the keydown while it bubbles.
    // A bubble-phase window listener would never see it; our capture-phase one already fired.
    const swallow = (e: Event) => e.stopPropagation();
    document.addEventListener('keydown', swallow);
    try {
      fireEvent.keyDown(document.body, { key: 'ArrowRight' });
      expect(onSkip).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener('keydown', swallow);
    }
  });

  it('single-item deck hides the prev/next chevrons (nothing to cycle to) (#988)', () => {
    render(
      <InboxProcessDialog
        node={node()}
        open
        onOpenChange={vi.fn()}
        onResolve={vi.fn()}
        onDelete={vi.fn()}
        onSkip={vi.fn()}
        onPrev={vi.fn()}
        remaining={1}
        position={1}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Next item' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Previous item' })).not.toBeInTheDocument();
    // …but Delete stays — you can still bin the single item.
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });
});
