import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceContext } from '@/store/workspace-context';
import type { UseWorkspace } from '@/store/useWorkspace';
import { createDefaultWorkspace } from '@/domain/createWorkspace';
import type { Bookmark, WorkspaceDocument } from '@/domain/types';
import { BookmarkBar } from './BookmarkBar';
import { AddBookmarkButton } from './AddBookmarkButton';

function ws(bookmarks: Bookmark[], over: Partial<WorkspaceDocument> = {}): UseWorkspace {
  const document: WorkspaceDocument = { ...createDefaultWorkspace(), bookmarks, ...over };
  return {
    document,
    loading: false,
    error: null,
    noRemote: false,
    creating: false,
    createWorkspace: vi.fn(),
    notice: null,
    clearNotice: vi.fn(),
    retry: vi.fn(),
    retrySync: vi.fn(),
    flush: async () => true,
    getCommittedDocument: () => document,
    dispatch: vi.fn(),
  };
}

function renderWithWs(ui: React.ReactNode, workspace: UseWorkspace) {
  return render(
    <WorkspaceContext.Provider value={workspace}>
      <MemoryRouter initialEntries={['/inbox']}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <span data-testid="path">{(<Path />)}</span>
                {ui}
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </WorkspaceContext.Provider>,
  );
}

function Path() {
  return <>{useLocation().pathname + useLocation().search}</>;
}

const projectBm: Bookmark = { id: 'b1', label: 'Vacation', kind: 'project', projectId: 'p1', color: '#3b82f6' };
const projectBm2: Bookmark = { id: 'b2', label: 'Errands', kind: 'project', projectId: 'p2', color: '#10b981' };
// Live project nodes so the bookmarks aren't stale (a stale bookmark disables its Go button).
const liveNodes = {
  p1: { id: 'p1', title: 'Vacation', project: true } as never,
  p2: { id: 'p2', title: 'Errands', project: true } as never,
};

describe('BookmarkBar', () => {
  it('renders nothing when there are no bookmarks', () => {
    const { container } = renderWithWs(<BookmarkBar />, ws([]));
    expect(container.querySelector('[aria-label="Bookmarks"]')).toBeNull();
  });

  it('navigates to a bookmark target on click', () => {
    const workspace = ws([projectBm], { nodes: liveNodes });
    renderWithWs(<BookmarkBar />, workspace);
    fireEvent.click(screen.getByRole('button', { name: 'Go to bookmark: Vacation' }));
    expect(screen.getByTestId('path').textContent).toBe('/projects/p1');
  });

  it('the focus glyph deals the deck scoped to the bookmark (#739)', () => {
    const workspace = ws([projectBm], { nodes: liveNodes });
    renderWithWs(<BookmarkBar />, workspace);
    fireEvent.click(screen.getByRole('button', { name: 'Focus: Vacation' }));
    expect(screen.getByTestId('path').textContent).toBe('/focus?project=p1');
  });

  it('a stale bookmark offers no focus glyph (#739)', () => {
    const workspace = ws([{ ...projectBm, projectId: 'gone' }]);
    renderWithWs(<BookmarkBar />, workspace);
    expect(screen.queryByRole('button', { name: 'Focus: Vacation' })).not.toBeInTheDocument();
  });

  it('removes a bookmark via its × control', () => {
    const workspace = ws([projectBm], { nodes: liveNodes });
    renderWithWs(<BookmarkBar />, workspace);
    fireEvent.click(screen.getByRole('button', { name: 'Remove bookmark: Vacation' }));
    expect(workspace.dispatch).toHaveBeenCalledWith({ type: 'removeBookmark', id: 'b1' });
  });

  it('greys out and disables a stale project bookmark (project gone)', () => {
    const workspace = ws([projectBm]); // p1 not in nodes → stale
    renderWithWs(<BookmarkBar />, workspace);
    const button = screen.getByRole('button', { name: 'Go to bookmark: Vacation' });
    expect(button).toBeDisabled();
  });

  it('reorders with move up/down, committing the full order (#636)', () => {
    const workspace = ws([projectBm, projectBm2], { nodes: liveNodes });
    renderWithWs(<BookmarkBar />, workspace);
    // The first row can't move up, the last can't move down.
    expect(screen.getByRole('button', { name: 'Move Vacation up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Errands down' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Move Errands up' }));
    expect(workspace.dispatch).toHaveBeenCalledWith({ type: 'reorderBookmarks', order: ['b2', 'b1'] });
  });

  it('shows visible labels and navigates + fires onNavigate (phone)', () => {
    const onNavigate = vi.fn();
    const workspace = ws([projectBm], { nodes: liveNodes });
    renderWithWs(<BookmarkBar onNavigate={onNavigate} />, workspace);
    // The label is visible text (not just a tooltip) for touch.
    expect(screen.getByText('Vacation')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Go to bookmark: Vacation' }));
    expect(screen.getByTestId('path').textContent).toBe('/projects/p1');
    expect(onNavigate).toHaveBeenCalled();
  });
});

describe('AddBookmarkButton', () => {
  it('adds a bookmark when the target is not yet saved', () => {
    const workspace = ws([]);
    renderWithWs(<AddBookmarkButton draft={{ kind: 'project', projectId: 'p1', label: 'Vacation' }} />, workspace);
    fireEvent.click(screen.getByRole('button', { name: 'Bookmark this' }));
    expect(workspace.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'addBookmark', bookmark: expect.objectContaining({ kind: 'project', projectId: 'p1', label: 'Vacation' }) }),
    );
  });

  it('removes the bookmark when the target is already saved', () => {
    const workspace = ws([projectBm]);
    renderWithWs(<AddBookmarkButton draft={{ kind: 'project', projectId: 'p1', label: 'Vacation' }} />, workspace);
    fireEvent.click(screen.getByRole('button', { name: 'Remove bookmark' }));
    expect(workspace.dispatch).toHaveBeenCalledWith({ type: 'removeBookmark', id: 'b1' });
  });
});
