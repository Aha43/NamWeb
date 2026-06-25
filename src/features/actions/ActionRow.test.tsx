import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ActionRow } from './ActionRow';
import type { ActionRowData } from './rows';

function row(over: Partial<ActionRowData> = {}): ActionRowData {
  return { id: 'a', title: 'Buy tiles', description: null, status: 'NEXT', path: [], tags: [], dueAt: null, touchedAt: null, ...over };
}

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
});
