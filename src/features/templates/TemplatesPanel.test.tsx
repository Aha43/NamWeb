import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectTemplate } from '../../domain/types';
import { TemplatesPanel } from './TemplatesPanel';

describe('TemplatesPanel', () => {
  it('shows the empty state with no templates', () => {
    render(<TemplatesPanel templates={[]} onDelete={vi.fn()} />);
    expect(screen.getByText('No templates yet.')).toBeInTheDocument();
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
});
