import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { SearchPanel, type SearchResultRow } from './SearchPanel';

const result: SearchResultRow = {
  id: 'a',
  title: 'Ship it',
  type: 'Action',
  path: [{ id: 'w', title: 'Work' }],
};

const renderPanel = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('SearchPanel', () => {
  it('prompts to type when the query is empty', () => {
    renderPanel(<SearchPanel query="" results={[]} onQueryChange={vi.fn()} onOpen={vi.fn()} />);
    expect(screen.getByText('Type to search.')).toBeInTheDocument();
  });

  it('shows a no-results message', () => {
    renderPanel(<SearchPanel query="zzz" results={[]} onQueryChange={vi.fn()} onOpen={vi.fn()} />);
    expect(screen.getByText('No results for “zzz”.')).toBeInTheDocument();
  });

  it('reports typing and opens a result', () => {
    const onQueryChange = vi.fn();
    const onOpen = vi.fn();
    renderPanel(<SearchPanel query="ship" results={[result]} onQueryChange={onQueryChange} onOpen={onOpen} />);
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'shi' } });
    expect(onQueryChange).toHaveBeenCalledWith('shi');
    expect(screen.getByText('Ship it')).toBeInTheDocument();
    expect(screen.getByText('Action')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open Ship it' }));
    expect(onOpen).toHaveBeenCalledWith(result);
  });

  it('renders the project path as a live link to the project (#979)', () => {
    renderPanel(<SearchPanel query="ship" results={[result]} onQueryChange={vi.fn()} onOpen={vi.fn()} />);
    // The path component is a real link, not plain text — and it is NOT nested in the open-button.
    const link = screen.getByRole('link', { name: 'Work' });
    expect(link).toHaveAttribute('href', '/projects/w');
  });
});
