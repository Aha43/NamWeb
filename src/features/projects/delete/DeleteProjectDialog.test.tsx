import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NamNode } from '@/domain/types';
import { DeleteProjectDialog } from './DeleteProjectDialog';

function project(id: string): NamNode {
  return {
    id, title: id, description: null, status: 'BACKLOG', project: true,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null,
  };
}

const props = {
  isTopLevel: false,
  actionCount: 2,
  subCount: 1,
  onCancel: vi.fn(),
  onConfirm: vi.fn(),
};

describe('DeleteProjectDialog (#485)', () => {
  it('resets destructive choices to safe defaults when opened for another project', () => {
    const view = render(<DeleteProjectDialog project={project('A')} {...props} />);

    // Choose the destructive options for project A.
    fireEvent.click(screen.getByRole('radio', { name: 'Delete the actions' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Delete the sub-projects' }));
    expect(screen.getByRole('radio', { name: 'Delete the actions' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Delete the sub-projects' })).toBeChecked();

    // Close, then open for a different project.
    view.rerender(<DeleteProjectDialog project={null} {...props} />);
    view.rerender(<DeleteProjectDialog project={project('B')} {...props} />);

    // Both back to "Move" (keep) — choices never carry over.
    expect(screen.getByRole('radio', { name: 'Move the actions to the parent project' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Move the sub-projects to the parent project' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Delete the actions' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Delete the sub-projects' })).not.toBeChecked();
  });
});
