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
  it('resolves to a top-level project', () => {
    const onResolve = vi.fn();
    render(<InboxProcessDialog node={node()} open onOpenChange={vi.fn()} onResolve={onResolve} />);
    fireEvent.click(screen.getByRole('button', { name: /make a project/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Make project' }));
    expect(onResolve).toHaveBeenCalledWith({ kind: 'project', parentId: undefined });
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
    expect(onResolve).toHaveBeenCalledWith({ kind: 'project', parentId: 'p2' });
  });

  it('omits the picker when there are no projects yet', () => {
    render(<InboxProcessDialog node={node()} open onOpenChange={vi.fn()} onResolve={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /one action/i }));
    expect(screen.queryByRole('combobox', { name: 'File under' })).not.toBeInTheDocument();
  });

  it('deck mode shows the "X of N" position + Delete/Prev/Skip and does not self-close on resolve', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Skip →' }));
    expect(onSkip).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '← Prev' }));
    expect(onPrev).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalled();
    // Resolving in deck mode advances via the parent — it must NOT close the dialog itself.
    fireEvent.click(screen.getByRole('button', { name: /make a project/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Make project' }));
    expect(onResolve).toHaveBeenCalledWith({ kind: 'project', parentId: undefined });
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('deck mode cycles the item with the ←/→ arrow keys (roll-over visible via "X of N")', () => {
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
    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'ArrowRight' });
    expect(onSkip).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(dialog, { key: 'ArrowLeft' });
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it('single-item deck hides Prev/Skip (nothing to cycle to)', () => {
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
    expect(screen.queryByRole('button', { name: 'Skip →' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '← Prev' })).not.toBeInTheDocument();
  });
});
