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

  it('autosaves tags on blur, even when typed-then-blurred in one go (#444)', () => {
    const onSave = vi.fn();
    render(
      <ProjectDetailsPanel project={project()} collapsed={false} onToggle={vi.fn()} onSave={onSave} availableTags={['home']} />,
    );
    const tags = screen.getByLabelText('Tags');
    // Type then immediately blur — the commit reads the ref, so the just-typed value isn't lost.
    fireEvent.change(tags, { target: { value: 'home' } });
    fireEvent.blur(tags);
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ tags: ['home'] }));
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

  it('autosaves a full date range with times — parity with the action editor (#699)', () => {
    const onSave = vi.fn();
    render(
      <ProjectDetailsPanel
        project={project({ dueAt: '2026-08-10' })}
        collapsed={false}
        onToggle={vi.fn()}
        onSave={onSave}
      />,
    );
    // The extras are collapsed (only a start date is set) — expand, then fill the range + times.
    fireEvent.click(screen.getByRole('button', { name: /add time or a range/i }));
    const end = screen.getByLabelText('Due end (optional)');
    fireEvent.change(end, { target: { value: '26-8-12' } });
    fireEvent.blur(end);
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ dueAt: '2026-08-10', dueEndAt: '2026-08-12', dueTime: null, dueEndTime: null }),
    );
    const time = screen.getByLabelText('Due time (optional)');
    fireEvent.change(time, { target: { value: '9' } });
    fireEvent.blur(time);
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ dueTime: '09:00' }));
    // A commit from ANOTHER field still carries the due set (the panel mirrors the last commit).
    const title = screen.getByLabelText('Title');
    fireEvent.change(title, { target: { value: 'Roof v2' } });
    fireEvent.blur(title);
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Roof v2', dueAt: '2026-08-10', dueEndAt: '2026-08-12', dueTime: '09:00' }),
    );
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

  it('requests delete (the advanced-delete dialog then confirms)', () => {
    const onDelete = vi.fn();
    render(
      <ProjectDetailsPanel
        project={project()}
        collapsed={false}
        onToggle={vi.fn()}
        onSave={vi.fn()}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete project' }));
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
