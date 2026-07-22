import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectTemplate } from '../../domain/types';
import { TemplatesPanel } from './TemplatesPanel';

describe('TemplatesPanel', () => {
  it('shows the empty state with no templates', () => {
    render(<TemplatesPanel templates={[]} onDelete={vi.fn()} />);
    expect(screen.getByText('No templates yet')).toBeInTheDocument();
  });

  it('lists templates with their item count and deletes by name', () => {
    const onDelete = vi.fn();
    const template: ProjectTemplate = {
      name: 'Reno',
      children: [{ title: 'Plumbing', project: true, children: [{ title: 'Fit pipe', project: false, children: [] }] }],
    };
    render(<TemplatesPanel templates={[template]} onDelete={onDelete} />);
    expect(screen.getByText('Reno')).toBeInTheDocument();
    expect(screen.getByText('2 items')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete template Reno' }));
    expect(onDelete).toHaveBeenCalledWith('Reno');
  });

  it('offers "Create project" per template when onUse is given, and fires it by name (#864)', () => {
    const onUse = vi.fn();
    const template: ProjectTemplate = { name: 'Reno', children: [] };
    render(<TemplatesPanel templates={[template]} onDelete={vi.fn()} onUse={onUse} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create a project from the Reno template' }));
    expect(onUse).toHaveBeenCalledWith('Reno');
  });

  it('omits the Create-project action when onUse is not provided', () => {
    render(<TemplatesPanel templates={[{ name: 'Reno', children: [] }]} onDelete={vi.fn()} />);
    expect(screen.queryByText('Create project')).not.toBeInTheDocument();
  });
});
