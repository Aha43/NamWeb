import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceContext } from '@/store/workspace-context';
import { SettingsContext, type SettingsContextValue, type BookmarkStyle } from '@/components/settings/settings-context';
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

function settings(bookmarkStyle: BookmarkStyle): SettingsContextValue {
  return {
    dateFormat: 'medium',
    setDateFormat: vi.fn(),
    language: 'en',
    setLanguage: vi.fn(),
    bookmarkStyle,
    setBookmarkStyle: vi.fn(),
    addToBottom: false,
    setAddToBottom: vi.fn(),
    addToBottomDefault: false,
    setAddToBottomDefault: vi.fn(),
  };
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
    expect(screen.getByTestId('path').textContent).toBe('/tags?tags=home');
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

  it('bar variant hides labels by default (icons mode)', () => {
    const workspace = ws([{ id: 'b2', label: '#home', kind: 'tagFilter', tags: ['home'], nextOnly: false, color: '#10b981' }]);
    renderWithWs(<BookmarkBar />, workspace); // no SettingsProvider → fallback 'icons'
    expect(screen.queryByText('#home')).toBeNull(); // name is in the tooltip, not visible text
    expect(screen.getByRole('button', { name: 'Go to bookmark: #home' })).toBeInTheDocument();
  });

  it('bar variant shows visible labels when the setting is "labels" (#560)', () => {
    const workspace = ws([{ id: 'b2', label: '#home', kind: 'tagFilter', tags: ['home'], nextOnly: false, color: '#10b981' }]);
    render(
      <SettingsContext.Provider value={settings('labels')}>
        <WorkspaceContext.Provider value={workspace}>
          <MemoryRouter>
            <BookmarkBar />
          </MemoryRouter>
        </WorkspaceContext.Provider>
      </SettingsContext.Provider>,
    );
    expect(screen.getByText('#home')).toBeInTheDocument();
  });

  it('list variant shows visible labels and navigates + fires onNavigate (phone)', () => {
    const onNavigate = vi.fn();
    const workspace = ws([{ id: 'b2', label: '#home', kind: 'tagFilter', tags: ['home'], nextOnly: false, color: '#10b981' }]);
    renderWithWs(<BookmarkBar variant="list" onNavigate={onNavigate} />, workspace);
    // The label is visible text (not just a tooltip) for touch.
    expect(screen.getByText('#home')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Go to bookmark: #home' }));
    expect(screen.getByTestId('path').textContent).toBe('/tags?tags=home');
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
