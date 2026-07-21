import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
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

describe('BookmarkBar', () => {
  it('renders nothing when there are no bookmarks', () => {
    const { container } = renderWithWs(<BookmarkBar />, ws([]));
    expect(container.querySelector('[aria-label="Bookmarks"]')).toBeNull();
  });

  it('navigates to a bookmark target on click', () => {
    const workspace = ws([{ id: 'b2', label: '#home', kind: 'tagFilter', tags: ['home'], nextOnly: false, color: '#10b981' }]);
    renderWithWs(<BookmarkBar />, workspace);
    fireEvent.click(screen.getByRole('button', { name: 'Go to bookmark: #home' }));
    expect(screen.getByTestId('path').textContent).toBe('/tags?tags=home&bm=b2');
  });

  it('the focus glyph deals the deck scoped to the bookmark (#739)', () => {
    const workspace = ws([
      { id: 'b2', label: 'After work', kind: 'tagFilter', tags: ['daily'], nextOnly: true, color: '#10b981' },
    ]);
    renderWithWs(<BookmarkBar />, workspace);
    fireEvent.click(screen.getByRole('button', { name: 'Focus: After work' }));
    expect(screen.getByTestId('path').textContent).toBe('/focus?tags=daily&next=1&bm=b2');
  });

  it('a stale bookmark offers no focus glyph (#739)', () => {
    const workspace = ws([{ ...projectBm, projectId: 'gone' }]);
    renderWithWs(<BookmarkBar />, workspace);
    expect(screen.queryByRole('button', { name: 'Focus: Vacation' })).not.toBeInTheDocument();
  });

  it('removes a bookmark via its × control', () => {
    const workspace = ws([projectBm], { nodes: { p1: { id: 'p1', title: 'Vacation', project: true } as never } });
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
    const tagBm: Bookmark = { id: 'b2', label: '#home', kind: 'tagFilter', tags: ['home'], nextOnly: false, color: '#10b981' };
    const workspace = ws([projectBm, tagBm]);
    renderWithWs(<BookmarkBar />, workspace);
    // The first row can't move up, the last can't move down.
    expect(screen.getByRole('button', { name: 'Move Vacation up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move #home down' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Move #home up' }));
    expect(workspace.dispatch).toHaveBeenCalledWith({ type: 'reorderBookmarks', order: ['b2', 'b1'] });
  });

  it('shows visible labels and navigates + fires onNavigate (phone)', () => {
    const onNavigate = vi.fn();
    const workspace = ws([{ id: 'b2', label: '#home', kind: 'tagFilter', tags: ['home'], nextOnly: false, color: '#10b981' }]);
    renderWithWs(<BookmarkBar onNavigate={onNavigate} />, workspace);
    // The label is visible text (not just a tooltip) for touch.
    expect(screen.getByText('#home')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Go to bookmark: #home' }));
    expect(screen.getByTestId('path').textContent).toBe('/tags?tags=home&bm=b2');
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
