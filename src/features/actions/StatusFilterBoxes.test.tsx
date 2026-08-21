import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StatusFilterBoxes, ChecklistDoneToggle } from './StatusFilterBoxes';

describe('StatusFilterBoxes', () => {
  it('renders the three include-boxes reflecting the boxes state', () => {
    render(<StatusFilterBoxes boxes={{ NEXT: true, BACKLOG: true, DONE: false }} onToggle={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: 'Next' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Backlog' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Done' })).not.toBeChecked();
  });

  it('reports the toggled status', () => {
    const onToggle = vi.fn();
    render(<StatusFilterBoxes boxes={{ NEXT: true, BACKLOG: true, DONE: true }} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Done' }));
    expect(onToggle).toHaveBeenCalledWith('DONE');
  });
});

describe('ChecklistDoneToggle (#1155)', () => {
  it('renders a single "Show done" toggle — no Next/Backlog boxes — reflecting showDone', () => {
    const { rerender } = render(<ChecklistDoneToggle showDone onToggle={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: 'Show done' })).toBeChecked();
    expect(screen.queryByRole('checkbox', { name: 'Next' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Backlog' })).not.toBeInTheDocument();
    rerender(<ChecklistDoneToggle showDone={false} onToggle={vi.fn()} />);
    expect(screen.getByRole('checkbox', { name: 'Show done' })).not.toBeChecked();
  });

  it('fires onToggle when clicked', () => {
    const onToggle = vi.fn();
    render(<ChecklistDoneToggle showDone onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show done' }));
    expect(onToggle).toHaveBeenCalled();
  });
});
