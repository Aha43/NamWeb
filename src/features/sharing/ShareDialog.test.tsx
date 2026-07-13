import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { User } from '@supabase/supabase-js';
import type { NamNode, WorkspaceDocument } from '@/domain/types';
import type { UseWorkspace } from '@/store/useWorkspace';
import { WorkspaceContext } from '@/store/workspace-context';
import { AuthUserContext } from '@/auth/auth-context';
import { SettingsContext, type SettingsContextValue } from '@/components/settings/settings-context';

const service = {
  fetchShare: vi.fn(),
  publishShare: vi.fn(),
  unpublishShare: vi.fn(),
  rotateShareToken: vi.fn(),
};
vi.mock('./shares', async (orig) => ({
  ...(await orig<typeof import('./shares')>()),
  fetchShare: (...a: unknown[]) => service.fetchShare(...a),
  publishShare: (...a: unknown[]) => service.publishShare(...a),
  unpublishShare: (...a: unknown[]) => service.unpublishShare(...a),
  rotateShareToken: (...a: unknown[]) => service.rotateShareToken(...a),
}));

import { ShareButton } from './ShareButton';

function node(id: string, p: Partial<NamNode> = {}): NamNode {
  return {
    id, title: id, description: null, status: 'BACKLOG', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...p,
  };
}

const doc: WorkspaceDocument = {
  formatVersion: 1, rootNodeId: 'root', inboxNodeId: 'inbox', projectsNodeId: 'projects', nextActionsNodeId: 'actions',
  nodes: {
    root: node('root', { childIds: ['inbox', 'projects', 'actions'] }),
    inbox: node('inbox'),
    projects: node('projects', { childIds: ['trip'] }),
    actions: node('actions'),
    trip: node('trip', { title: 'Asia trip', project: true, childIds: ['a1', 'p1'] }),
    a1: node('a1', { title: 'Book flights', status: 'NEXT' }),
    p1: node('p1', { title: 'Budget', project: true, tags: ['private'] }),
  },
  registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
};

const REAL_USER = { id: 'u1', aud: 'authenticated' } as unknown as User;
const DEMO_USER = { id: 'demo-user', aud: 'demo' } as unknown as User;

function renderButton({ labs = true, user = REAL_USER as User | undefined } = {}) {
  return render(
    <SettingsContext.Provider value={{ labs, setLabs: vi.fn() } as unknown as SettingsContextValue}>
      <AuthUserContext.Provider value={user}>
        <WorkspaceContext.Provider value={{ document: doc, dispatch: vi.fn() } as unknown as UseWorkspace}>
          <ShareButton projectId="trip" />
        </WorkspaceContext.Provider>
      </AuthUserContext.Provider>
    </SettingsContext.Provider>,
  );
}

beforeEach(() => {
  service.fetchShare.mockReset().mockResolvedValue(null);
  service.publishShare.mockReset();
  service.unpublishShare.mockReset().mockResolvedValue(undefined);
  service.rotateShareToken.mockReset();
});

describe('ShareButton gating (#759 — dark until the 2.0.0 cut)', () => {
  it('renders nothing without Labs', () => {
    renderButton({ labs: false });
    expect(screen.queryByRole('button', { name: 'Share project' })).not.toBeInTheDocument();
  });

  it('renders nothing in the demo (no backend to publish to)', () => {
    renderButton({ user: DEMO_USER });
    expect(screen.queryByRole('button', { name: 'Share project' })).not.toBeInTheDocument();
  });

  it('renders nothing without an auth provider (presentational hosts)', () => {
    render(
      <SettingsContext.Provider value={{ labs: true, setLabs: vi.fn() } as unknown as SettingsContextValue}>
        <ShareButton projectId="trip" />
      </SettingsContext.Provider>,
    );
    expect(screen.queryByRole('button', { name: 'Share project' })).not.toBeInTheDocument();
  });
});

describe('ShareDialog', () => {
  it('publish mints the share (double-publish: token then salted content) and shows the secret URL', async () => {
    service.publishShare
      .mockResolvedValueOnce({ token: 'tok123', project_id: 'trip', content: { version: 1 }, enabled: true, updated_at: 'x' })
      .mockResolvedValueOnce({ token: 'tok123', project_id: 'trip', content: { version: 1 }, enabled: true, updated_at: 'x' });
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: 'Share project' }));
    await waitFor(() => expect(screen.getByText(/Not published/)).toBeInTheDocument());
    // Defaults per the design doc: dates on, progress off, notes on.
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes.map((b) => (b as HTMLInputElement).checked)).toEqual([true, false, true]);
    // The private sub-project is surfaced, not silent.
    expect(screen.getByText(/1 item\(s\) tagged private/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(screen.getByLabelText('Secret share link')).toBeInTheDocument());
    expect(screen.getByLabelText('Secret share link')).toHaveValue(`${window.location.origin}/p/tok123`);
    // First publish runs twice: mint with placeholder salt, then re-salt with the real token.
    expect(service.publishShare).toHaveBeenCalledTimes(2);
    const salted = service.publishShare.mock.calls[1][2];
    expect(JSON.stringify(salted)).not.toContain('Budget'); // the private subtree stayed home
    expect(salted.title).toBe('Asia trip');
  });

  it('unpublish confirms, deletes, and returns to the unpublished state', async () => {
    service.fetchShare.mockResolvedValue({ token: 'tok123', project_id: 'trip', content: { version: 1, title: 'Asia trip', publishedAt: 'x', items: [], sections: [] }, enabled: true, updated_at: 'x' });
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: 'Share project' }));
    await waitFor(() => expect(screen.getByLabelText('Secret share link')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Unpublish this project' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }));
    await waitFor(() => expect(service.unpublishShare).toHaveBeenCalledWith('tok123'));
    await waitFor(() => expect(screen.getByText(/Not published/)).toBeInTheDocument());
  });

  it('a jsonb-reordered (but identical) snapshot is NOT dirty (#772/F2)', async () => {
    // Simulate the Postgres round-trip: identical content, every object's keys re-ordered
    // (jsonb sorts by length then bytewise — any deterministic reorder proves the point).
    const { shareContent } = await import('@/domain/shareContent');
    const now = shareContent(doc, 'trip', { includeDue: true, includeStatus: false, includeNotes: true, salt: 'tok123', publishedAt: 'later' })!;
    const reorder = (v: unknown): unknown =>
      Array.isArray(v)
        ? v.map(reorder)
        : v && typeof v === 'object'
          ? Object.fromEntries(Object.keys(v as object).reverse().map((k) => [k, reorder((v as Record<string, unknown>)[k])]))
          : v;
    const reordered = reorder(now);
    service.fetchShare.mockResolvedValue({ token: 'tok123', project_id: 'trip', content: reordered, enabled: true, updated_at: 'x' });
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: 'Share project' }));
    await waitFor(() => expect(screen.getByLabelText('Secret share link')).toBeInTheDocument());
    expect(screen.queryByText(/changed since the last publish/)).not.toBeInTheDocument();
  });

  it('a stale snapshot shows the republish hint', async () => {
    // Stored content deliberately differs from what the sanitizer produces now.
    service.fetchShare.mockResolvedValue({ token: 'tok123', project_id: 'trip', content: { version: 1, title: 'Old title', publishedAt: 'x', items: [], sections: [] }, enabled: true, updated_at: 'x' });
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: 'Share project' }));
    await waitFor(() => expect(screen.getByText(/changed since the last publish/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Republish' })).toBeInTheDocument();
  });
});
