import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SearchPanel, type SearchResultRow } from './SearchPanel';

const result: SearchResultRow = { id: 'p', title: 'Roadmap', type: 'Project', path: ['Work'] };

describe('SearchPanel', () => {
  it('prompts to type when the query is empty', () => {
    render(<SearchPanel query="" results={[]} onQueryChange={vi.fn()} onOpen={vi.fn()} />);
    expect(screen.getByText('Type to search.')).toBeInTheDocument();
  });

  it('shows a no-results message', () => {
    render(<SearchPanel query="zzz" results={[]} onQueryChange={vi.fn()} onOpen={vi.fn()} />);
    expect(screen.getByText('No results for “zzz”.')).toBeInTheDocument();
  });

  it('reports typing and opens a result', () => {
    const onQueryChange = vi.fn();
    const onOpen = vi.fn();
    render(<SearchPanel query="road" results={[result]} onQueryChange={onQueryChange} onOpen={onOpen} />);
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'roadm' } });
    expect(onQueryChange).toHaveBeenCalledWith('roadm');
    expect(screen.getByText('Roadmap')).toBeInTheDocument();
    expect(screen.getByText('Project')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open Roadmap' }));
    expect(onOpen).toHaveBeenCalledWith(result);
  });
});
