import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceContext } from '@/store/workspace-context';
import type { UseWorkspace, SyncNotice as Notice } from '@/store/useWorkspace';
import { SyncNotice } from './SyncNotice';

function ws(notice: Notice | null, over: Partial<UseWorkspace> = {}): UseWorkspace {
  return {
    document: null,
    loading: false,
    error: null,
    noRemote: false,
    creating: false,
    createWorkspace: vi.fn(),
    notice,
    clearNotice: vi.fn(),
    retry: vi.fn(),
    retrySync: vi.fn(),
    flush: async () => true,
    getCommittedDocument: () => null,
    dispatch: vi.fn(),
    ...over,
  };
}

function renderNotice(value: UseWorkspace) {
  render(
    <WorkspaceContext.Provider value={value}>
      <SyncNotice />
    </WorkspaceContext.Provider>,
  );
}

describe('SyncNotice', () => {
  it('renders nothing when there is no notice', () => {
    const { container } = render(
      <WorkspaceContext.Provider value={ws(null)}>
        <SyncNotice />
      </WorkspaceContext.Provider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('info notice: status role, translated message, Dismiss only (no Retry)', () => {
    const value = ws({ kind: 'info', messageKey: 'sync.updatedFromDevice' });
    renderNotice(value);
    expect(screen.getByRole('status')).toHaveTextContent('Updated from another device');
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(value.clearNotice).toHaveBeenCalledOnce();
  });

  it('error notice: alert role, Retry calls retrySync', () => {
    const value = ws({ kind: 'error', messageKey: 'sync.saveFailed' });
    renderNotice(value);
    expect(screen.getByRole('alert')).toHaveTextContent('Couldn’t save');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(value.retrySync).toHaveBeenCalledOnce();
  });

  it('a raw server detail overrides the key (#580)', () => {
    const value = ws({ kind: 'error', messageKey: 'sync.createFailed', raw: 'quota exceeded' });
    renderNotice(value);
    expect(screen.getByRole('alert')).toHaveTextContent('quota exceeded');
  });
});
