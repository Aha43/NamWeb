import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ActionRow } from './ActionRow';
import type { ActionRowData } from './rows';
import { SettingsContext, type SettingsContextValue } from '@/components/settings/settings-context';

function row(over: Partial<ActionRowData> = {}): ActionRowData {
  return { id: 'a', title: 'Buy tiles', description: null, status: 'NEXT', path: [], tags: [], dueAt: null, touchedAt: null, ...over };
}

describe('ActionRow — the phone "…" reveal (#776)', () => {
  const row: ActionRowData = {
    id: 'a', title: 'Book flights', description: null, status: 'NEXT',
    path: [], tags: [], dueAt: null, touchedAt: null,
  };

  it('controls sit hidden behind the per-row reveal; tapping toggles them (jsdom = phone)', () => {
    render(
      <MemoryRouter>
        <ul><ActionRow row={row} actions={<button>Edit it</button>} /></ul>
      </MemoryRouter>,
    );
    const reveal = screen.getByRole('button', { name: 'Show actions for Book flights' });
    expect(reveal).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Edit it').parentElement).toHaveClass('hidden'); // present, not shown

    fireEvent.click(reveal);
    expect(reveal).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Edit it').parentElement).not.toHaveClass('hidden');
    fireEvent.click(reveal);
    expect(screen.getByText('Edit it').parentElement).toHaveClass('hidden');
  });
});

describe('ActionRow — compact rows (#765)', () => {
  const row: ActionRowData = {
    id: 'a', title: 'Book flights', description: null, status: 'NEXT',
    path: [{ id: 'p1', title: 'Trip' }], tags: ['economy'], dueAt: '2027-06-01', touchedAt: null,
  };

  it('compact drops the meta line and the path — name and controls only', () => {
    render(
      <MemoryRouter>
        <SettingsContext.Provider value={{ compactRows: true } as unknown as SettingsContextValue}>
          <ul><ActionRow row={row} actions={null} showPath /></ul>
        </SettingsContext.Provider>
      </MemoryRouter>,
    );
    expect(screen.getByText('Book flights')).toBeInTheDocument();
    expect(screen.queryByText('economy')).not.toBeInTheDocument();
    expect(screen.queryByText(/Due/)).not.toBeInTheDocument();
    expect(screen.queryByText('Trip')).not.toBeInTheDocument();
  });

  it('comfortable (default) keeps tags and due hints', () => {
    render(<MemoryRouter><ul><ActionRow row={row} actions={null} showPath /></ul></MemoryRouter>);
    expect(screen.getByText('economy')).toBeInTheDocument();
    expect(screen.getByText(/Due/)).toBeInTheDocument();
  });
});

describe('ActionRow', () => {
  it('opens the editor by clicking the title (no separate slider/edit icon)', () => {
    const onEdit = vi.fn();
    render(
      <ul>
        <ActionRow row={row()} actions={null} onEdit={onEdit} />
      </ul>,
    );
    // The click target is the title itself — there is a single Edit control, and it carries the title.
    const edit = screen.getAllByRole('button', { name: 'Edit Buy tiles' });
    expect(edit).toHaveLength(1);
    expect(edit[0]).toHaveTextContent('Buy tiles');
    fireEvent.click(edit[0]);
    expect(onEdit).toHaveBeenCalled();
  });

  it('still renders the title (as the editor trigger) when a description is present', () => {
    render(
      <ul>
        <ActionRow row={row({ description: 'Porcelain, matte finish' })} actions={null} onEdit={vi.fn()} />
      </ul>,
    );
    // Title stays the edit trigger; the description rides as a hover tooltip (armed via Tooltip).
    expect(screen.getByRole('button', { name: 'Edit Buy tiles' })).toHaveTextContent('Buy tiles');
  });

  it('tints the title by status when colorByStatus is on (#565)', () => {
    const { rerender } = render(
      <ul>
        <ActionRow row={row({ status: 'DONE' })} actions={null} />
      </ul>,
    );
    expect(screen.getByText('Buy tiles').className).toContain('text-green-600');

    rerender(
      <ul>
        <ActionRow row={row({ status: 'BACKLOG' })} actions={null} />
      </ul>,
    );
    expect(screen.getByText('Buy tiles').className).toContain('text-muted-foreground');
  });

  it('tints an in-progress row amber, overriding the status tone (#896)', () => {
    const { rerender } = render(
      <ul>
        <ActionRow row={row({ status: 'NEXT', tags: ['#in-progress'] })} actions={null} />
      </ul>,
    );
    const title = screen.getByText('Buy tiles');
    expect(title.className).toContain('text-amber-600');
    expect(title.className).not.toContain('text-primary'); // the NEXT tone is overridden

    // Case/legacy spelling from a NamDesktop-written doc still counts.
    rerender(
      <ul>
        <ActionRow row={row({ status: 'BACKLOG', tags: ['In Progress'] })} actions={null} />
      </ul>,
    );
    expect(screen.getByText('Buy tiles').className).toContain('text-amber-600');
  });

  it('does not amber-tint a finished (DONE) row, even if tagged in-progress (#896)', () => {
    render(
      <ul>
        <ActionRow row={row({ status: 'DONE', tags: ['#in-progress'] })} actions={null} />
      </ul>,
    );
    const title = screen.getByText('Buy tiles');
    expect(title.className).toContain('text-green-600');
    expect(title.className).not.toContain('text-amber-600');
  });

  it('does not tint in-progress when colorByStatus is off (single-status views) (#896)', () => {
    render(
      <ul>
        <ActionRow row={row({ status: 'NEXT', tags: ['#in-progress'] })} actions={null} colorByStatus={false} />
      </ul>,
    );
    const title = screen.getByText('Buy tiles');
    expect(title.className).toContain('text-foreground');
    expect(title.className).not.toContain('text-amber-600');
  });

  it('leaves the title uncolored when colorByStatus is off (single-status views) (#565)', () => {
    render(
      <ul>
        <ActionRow row={row({ status: 'DONE' })} actions={null} colorByStatus={false} />
      </ul>,
    );
    const title = screen.getByText('Buy tiles');
    expect(title.className).toContain('text-foreground');
    expect(title.className).not.toContain('text-green-600');
  });
});
