import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConvertToProjectDialog } from './ConvertToProjectDialog';

describe('ConvertToProjectDialog (#999/#1000)', () => {
  it('collects names via Enter, renames one, removes one, includes a trailing draft, and confirms', () => {
    const onConfirm = vi.fn();
    render(<ConvertToProjectDialog open onOpenChange={vi.fn()} actionTitle="Plan trip" onConfirm={onConfirm} />);
    const input = screen.getByLabelText('Add an action');
    fireEvent.change(input, { target: { value: 'Book flights' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.change(input, { target: { value: 'Pack bags' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Rename the first row (fix a typo before the project exists).
    fireEvent.click(screen.getByRole('button', { name: 'Rename Book flights' }));
    const rowInput = screen.getByRole('textbox', { name: 'Rename Book flights' });
    fireEvent.change(rowInput, { target: { value: 'Book the flights' } });
    fireEvent.keyDown(rowInput, { key: 'Enter' });

    // Remove the second, leave a trailing un-added draft — it's included on create.
    fireEvent.click(screen.getByRole('button', { name: 'Remove Pack bags' }));
    fireEvent.change(input, { target: { value: 'Book hotel' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));

    // Project title defaults to the action title (unchanged), with the edited action list.
    expect(onConfirm).toHaveBeenCalledWith('Plan trip', ['Book the flights', 'Book hotel'], true);
  });

  it('lets you rename the project (seeded from the action) before creating', () => {
    const onConfirm = vi.fn();
    render(<ConvertToProjectDialog open onOpenChange={vi.fn()} actionTitle="Plan trip" onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename the project' }));
    const nameInput = screen.getByRole('textbox', { name: 'Rename Plan trip' });
    fireEvent.change(nameInput, { target: { value: 'Summer trip' } });
    fireEvent.keyDown(nameInput, { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
    expect(onConfirm).toHaveBeenCalledWith('Summer trip', [], true);
  });

  it('offers a continue button (openAfter=false) when continueLabel is set — the inbox flow (#1007)', () => {
    const onConfirm = vi.fn();
    render(
      <ConvertToProjectDialog
        open
        onOpenChange={vi.fn()}
        actionTitle="Plan trip"
        onConfirm={onConfirm}
        createLabel="Create & open project"
        continueLabel="Create & keep processing"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create & keep processing' }));
    expect(onConfirm).toHaveBeenCalledWith('Plan trip', [], false);
  });

  it('does not create via ⌘/Ctrl+Enter while an inline rename is active (#1000 review, P1)', () => {
    const onConfirm = vi.fn();
    render(<ConvertToProjectDialog open onOpenChange={vi.fn()} actionTitle="Plan trip" onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename the project' }));
    const nameInput = screen.getByRole('textbox', { name: 'Rename Plan trip' });
    fireEvent.change(nameInput, { target: { value: 'Summer trip' } });
    // The rename commits (InlineRename's Enter), but the parent shortcut must NOT create from stale
    // state — it waits for the next ⌘/Ctrl+Enter once editing is done.
    fireEvent.keyDown(nameInput, { key: 'Enter', metaKey: true });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('creates an empty project (keeping the action title) when nothing is entered', () => {
    const onConfirm = vi.fn();
    render(<ConvertToProjectDialog open onOpenChange={vi.fn()} actionTitle="Plan trip" onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
    expect(onConfirm).toHaveBeenCalledWith('Plan trip', [], true);
  });
});
