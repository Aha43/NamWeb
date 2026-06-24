import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { NamNode } from '@/domain/types';
import { ProjectDetailsPanel } from './ProjectDetailsPanel';

function project(partial: Partial<NamNode> = {}): NamNode {
  return {
    id: 'p', title: 'Kitchen reno', description: null, status: 'BACKLOG', project: true,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...partial,
  };
}

describe('ProjectDetailsPanel', () => {
  it('hides its fields when collapsed', () => {
    render(<ProjectDetailsPanel project={project()} collapsed onToggle={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Details' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('Title')).not.toBeInTheDocument();
  });

  it('seeds the fields from the project when open', () => {
    render(
      <ProjectDetailsPanel
        project={project({ title: 'Roof', description: 'fix the leak', tags: ['home'], dueAt: '2026-07-01' })}
        collapsed={false}
        onToggle={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Title')).toHaveValue('Roof');
    expect(screen.getByLabelText('Description')).toHaveValue('fix the leak');
    expect(screen.getByLabelText('Tags')).toHaveValue('home');
    expect(screen.getByLabelText('Due')).toHaveValue('2026-07-01');
  });

  it('has no Save button — it autosaves', () => {
    render(<ProjectDetailsPanel project={project()} collapsed={false} onToggle={vi.fn()} onSave={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('autosaves a text field on blur, trimming the title', () => {
    const onSave = vi.fn();
    render(<ProjectDetailsPanel project={project()} collapsed={false} onToggle={vi.fn()} onSave={onSave} />);
    const title = screen.getByLabelText('Title');
    fireEvent.change(title, { target: { value: '  Garden  ' } });
    expect(onSave).not.toHaveBeenCalled(); // not on every keystroke
    fireEvent.blur(title);
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Garden' }));
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });

  it('autosaves the due date on blur, parsing a flexible date', () => {
    const onSave = vi.fn();
    render(<ProjectDetailsPanel project={project()} collapsed={false} onToggle={vi.fn()} onSave={onSave} />);
    const due = screen.getByLabelText('Due');
    fireEvent.change(due, { target: { value: '26-8-15' } });
    fireEvent.blur(due);
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ dueAt: '2026-08-15' }));
    expect(due).toHaveValue('2026-08-15'); // normalized in place
  });

  it('autosaves a status change immediately', () => {
    const onSave = vi.fn();
    render(<ProjectDetailsPanel project={project()} collapsed={false} onToggle={vi.fn()} onSave={onSave} />);
    fireEvent.click(screen.getByText('Done')); // status radio
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ status: 'DONE' }));
  });

  it('does not autosave an empty title — restores the project value', () => {
    const onSave = vi.fn();
    render(<ProjectDetailsPanel project={project({ title: 'Roof' })} collapsed={false} onToggle={vi.fn()} onSave={onSave} />);
    const title = screen.getByLabelText('Title');
    fireEvent.change(title, { target: { value: '   ' } });
    fireEvent.blur(title);
    expect(onSave).not.toHaveBeenCalled();
    expect(title).toHaveValue('Roof');
  });

  it('flags an invalid due date on blur and does not persist it', () => {
    const onSave = vi.fn();
    render(<ProjectDetailsPanel project={project()} collapsed={false} onToggle={vi.fn()} onSave={onSave} />);
    const due = screen.getByLabelText('Due');
    fireEvent.change(due, { target: { value: 'whenever' } });
    fireEvent.blur(due);
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/date like/i);
  });

  it('deletes behind an inline confirm (when wired)', () => {
    const onDelete = vi.fn();
    render(
      <ProjectDetailsPanel
        project={project()}
        collapsed={false}
        onToggle={vi.fn()}
        onSave={vi.fn()}
        onDelete={onDelete}
        deleteConfirmMessage="Delete the Kitchen reno project?"
      />,
    );
    // First click arms the confirm; it does not delete yet.
    fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText('Delete the Kitchen reno project?')).toBeInTheDocument();
    // The confirm deletes.
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalled();
  });

  it('omits delete when not wired', () => {
    render(<ProjectDetailsPanel project={project()} collapsed={false} onToggle={vi.fn()} onSave={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Delete project' })).not.toBeInTheDocument();
  });

  it('toggles via the header button', () => {
    const onToggle = vi.fn();
    render(<ProjectDetailsPanel project={project()} collapsed onToggle={onToggle} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(onToggle).toHaveBeenCalled();
  });
});
