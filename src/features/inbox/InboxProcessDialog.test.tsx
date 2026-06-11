import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NamNode } from '@/domain/types';
import { InboxProcessDialog } from './InboxProcessDialog';

function node(): NamNode {
  return {
    id: 'a', title: 'Plan trip', description: null, status: 'BACKLOG', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null,
  };
}

describe('InboxProcessDialog', () => {
  it('resolves to a project from step one', () => {
    const onResolve = vi.fn();
    render(<InboxProcessDialog node={node()} open onOpenChange={vi.fn()} onResolve={onResolve} />);
    fireEvent.click(screen.getByRole('button', { name: /make a project/i }));
    expect(onResolve).toHaveBeenCalledWith({ kind: 'project' });
  });

  it('resolves to an action with the chosen status', () => {
    const onResolve = vi.fn();
    render(<InboxProcessDialog node={node()} open onOpenChange={vi.fn()} onResolve={onResolve} />);
    fireEvent.click(screen.getByRole('button', { name: /one action/i }));
    fireEvent.click(screen.getByRole('button', { name: /park for later/i }));
    expect(onResolve).toHaveBeenCalledWith({ kind: 'action', status: 'BACKLOG' });
  });
});
