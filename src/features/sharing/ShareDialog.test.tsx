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
  fetchSuggestions: vi.fn(),
  resolveSuggestion: vi.fn(),
  claimDrainableEvents: vi.fn(),
  deleteEvents: vi.fn(),
  fetchLeftoverDrained: vi.fn(),
  countShareEvents: vi.fn(),
  acquireDrainLease: vi.fn(),
  releaseDrainLease: vi.fn(),
};
vi.mock('./shares', async (orig) => ({
  ...(await orig<typeof import('./shares')>()),
  fetchShare: (...a: unknown[]) => service.fetchShare(...a),
  publishShare: (...a: unknown[]) => service.publishShare(...a),
  unpublishShare: (...a: unknown[]) => service.unpublishShare(...a),
  rotateShareToken: (...a: unknown[]) => service.rotateShareToken(...a),
  fetchSuggestions: (...a: unknown[]) => service.fetchSuggestions(...a),
  resolveSuggestion: (...a: unknown[]) => service.resolveSuggestion(...a),
  claimDrainableEvents: (...a: unknown[]) => service.claimDrainableEvents(...a),
  deleteEvents: (...a: unknown[]) => service.deleteEvents(...a),
  fetchLeftoverDrained: (...a: unknown[]) => service.fetchLeftoverDrained(...a),
  countShareEvents: (...a: unknown[]) => service.countShareEvents(...a),
  acquireDrainLease: (...a: unknown[]) => service.acquireDrainLease(...a),
  releaseDrainLease: (...a: unknown[]) => service.releaseDrainLease(...a),
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
    p1: node('p1', { title: 'Budget', project: true, tags: ['#shared-hide'] }),
  },
  registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
};

const REAL_USER = { id: 'u1', aud: 'authenticated' } as unknown as User;
const DEMO_USER = { id: 'demo-user', aud: 'demo' } as unknown as User;

function renderButton({ labs = true, user = REAL_USER as User | undefined, dispatch = vi.fn() } = {}) {
  render(
    <SettingsContext.Provider value={{ labs, setLabs: vi.fn() } as unknown as SettingsContextValue}>
      <AuthUserContext.Provider value={user}>
        <WorkspaceContext.Provider value={{ document: doc, dispatch, flush: async () => true, getCommittedDocument: () => doc } as unknown as UseWorkspace}>
          <ShareButton projectId="trip" />
        </WorkspaceContext.Provider>
      </AuthUserContext.Provider>
    </SettingsContext.Provider>,
  );
  return { dispatch };
}

beforeEach(() => {
  service.fetchShare.mockReset().mockResolvedValue(null);
  service.fetchSuggestions.mockReset().mockResolvedValue([]);
  service.resolveSuggestion.mockReset().mockResolvedValue(undefined);
  service.publishShare.mockReset();
  service.unpublishShare.mockReset().mockResolvedValue(undefined);
  service.rotateShareToken.mockReset();
  service.claimDrainableEvents.mockReset().mockResolvedValue([]);
  service.deleteEvents.mockReset().mockResolvedValue(undefined);
  service.fetchLeftoverDrained.mockReset().mockResolvedValue([]);
  service.countShareEvents.mockReset().mockResolvedValue(0);
  service.acquireDrainLease.mockReset().mockResolvedValue('lease-token'); // held by default
  service.releaseDrainLease.mockReset().mockResolvedValue(undefined);
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
    // Defaults per the design doc: dates on, progress off, notes on — and completed shown (#817).
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes.map((b) => (b as HTMLInputElement).checked)).toEqual([true, false, true, false]);
    // The private sub-project is surfaced, not silent.
    expect(screen.getByText(/1 item\(s\) tagged #shared-hide/)).toBeInTheDocument();

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

  it('republish after an unpublish-elsewhere honors the revocation — no silent re-mint (#774)', async () => {
    service.fetchShare.mockResolvedValue({ token: 'tok123', project_id: 'trip', content: { version: 1, title: 'Old', publishedAt: 'x', items: [], sections: [] }, enabled: true, updated_at: 'x' });
    service.publishShare.mockResolvedValue(null); // the row vanished under us
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: 'Share project' }));
    await waitFor(() => expect(screen.getByLabelText('Secret share link')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Republish' }));
    await waitFor(() => expect(screen.getByText(/unpublished on another device/)).toBeInTheDocument());
    expect(screen.getByText(/Not published/)).toBeInTheDocument(); // dropped to unpublished, honestly
    expect(service.publishShare).toHaveBeenCalledTimes(1); // and no second, fresh-token insert
  });

  it('the From-guests tray: adoption captures with provenance, dismissal just retires (#796)', async () => {
    service.fetchShare.mockResolvedValue({ token: 'tok123', share_id: 'sid1', project_id: 'trip', content: { version: 1, title: 'Asia trip', publishedAt: 'x', items: [], sections: [] }, enabled: true, updated_at: 'x' });
    service.fetchSuggestions.mockResolvedValue([
      { id: 1, share_id: 'sid1', guest_name: 'Anna', body: 'Ryokan night in Hakone?', node_id: null, handled: false, created_at: '2026-07-14T10:00:00Z' },
      { id: 2, share_id: 'sid1', guest_name: null, body: 'Skip Osaka', node_id: null, handled: false, created_at: '2026-07-14T11:00:00Z' },
    ]);
    const { dispatch } = renderButton();
    fireEvent.click(screen.getByRole('button', { name: 'Share project' }));
    await waitFor(() => expect(screen.getByText('From guests (2)')).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole('button', { name: 'To inbox' })[0]);
    await waitFor(() => expect(service.resolveSuggestion).toHaveBeenCalledWith(1));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'addInboxItem', title: 'Ryokan night in Hakone?' }),
    );
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'updateNode', description: expect.stringContaining('Suggested by Anna') }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(service.resolveSuggestion).toHaveBeenCalledWith(2));
    expect(screen.queryByText(/From guests/)).not.toBeInTheDocument(); // tray empties away
  });

  it('a slow tray fetch cannot install stale suggestions after close/reopen (#804 Codex P2)', async () => {
    service.fetchShare.mockResolvedValue({ token: 'tok123', share_id: 'sid1', project_id: 'trip', content: { version: 1, title: 'Asia trip', publishedAt: 'x', items: [], sections: [] }, enabled: true, updated_at: 'x' });
    let resolveSlow: (v: unknown) => void = () => {};
    service.fetchSuggestions.mockImplementationOnce(() => new Promise((r) => { resolveSlow = r; }));
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: 'Share project' }));
    await waitFor(() => expect(service.fetchSuggestions).toHaveBeenCalledTimes(1));
    // Close while the tray fetch is in flight…
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByLabelText('Secret share link')).not.toBeInTheDocument());
    // …reopen (this load's tray is empty), then the OLD request lands late: it must be dropped.
    fireEvent.click(screen.getByRole('button', { name: 'Share project' }));
    await waitFor(() => expect(screen.getByLabelText('Secret share link')).toBeInTheDocument());
    resolveSlow([{ id: 9, share_id: 'sid1', guest_name: null, body: 'stale ghost', node_id: null, handled: false, created_at: '2026-07-14T10:00:00Z' }]);
    await waitFor(() => expect(service.fetchSuggestions).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/From guests/)).not.toBeInTheDocument();
  });

  it('unpublish clears the From-guests tray — the rows cascade server-side (#804)', async () => {
    service.fetchShare.mockResolvedValue({ token: 'tok123', share_id: 'sid1', project_id: 'trip', content: { version: 1, title: 'Asia trip', publishedAt: 'x', items: [], sections: [] }, enabled: true, updated_at: 'x' });
    service.fetchSuggestions.mockResolvedValue([
      { id: 1, share_id: 'sid1', guest_name: null, body: 'Skip Osaka', node_id: null, handled: false, created_at: '2026-07-14T10:00:00Z' },
    ]);
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: 'Share project' }));
    await waitFor(() => expect(screen.getByText('From guests (1)')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Unpublish this project' }));
    fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }));
    await waitFor(() => expect(screen.getByText(/Not published/)).toBeInTheDocument());
    expect(screen.queryByText(/From guests/)).not.toBeInTheDocument();
  });

  it('the dialog-open drain (#811): claimed guest ticks land as intents, provenance shows', async () => {
    const { guestIdMap } = await import('@/domain/shareContent');
    doc.nodes['a1'].resources = [{ type: 'COUNT', value: '3/12', description: 'jars', guestEditable: true }];
    try {
      const pseudoA1 = [...guestIdMap(doc, 'trip', 'tok123').entries()].find(([, r]) => r === 'a1')![0];
      service.fetchShare.mockResolvedValue({ token: 'tok123', share_id: 'sid1', project_id: 'trip', content: { version: 1, title: 'Asia trip', publishedAt: 'x', items: [], sections: [] }, enabled: true, updated_at: 'x' });
      service.claimDrainableEvents.mockResolvedValue([
        { id: 7, node_id: pseudoA1, res_index: 0, delta: 1, answer: null },
        { id: 8, node_id: pseudoA1, res_index: 0, delta: 1, answer: null },
      ]);
      service.countShareEvents.mockResolvedValue(9);
      const { dispatch } = renderButton();
      fireEvent.click(screen.getByRole('button', { name: 'Share project' }));
      await waitFor(() => expect(screen.getByText('New guest ticks since your last look: 9')).toBeInTheDocument());
      // Per-event idempotent intents in id order — each carries its event id, no expectedValue chain.
      expect(dispatch).toHaveBeenNthCalledWith(1, expect.objectContaining({ type: 'incrementCountResource', id: 'a1', index: 0, delta: 1, eventId: 7 }));
      expect(dispatch).toHaveBeenNthCalledWith(2, expect.objectContaining({ type: 'incrementCountResource', id: 'a1', index: 0, delta: 1, eventId: 8 }));
    } finally {
      doc.nodes['a1'].resources = [];
    }
  });

  it('a lost claim race applies nothing (#811 — the other device won)', async () => {
    service.fetchShare.mockResolvedValue({ token: 'tok123', share_id: 'sid1', project_id: 'trip', content: { version: 1, title: 'Asia trip', publishedAt: 'x', items: [], sections: [] }, enabled: true, updated_at: 'x' });
    service.claimDrainableEvents.mockResolvedValue([]); // another device won the split
    const { dispatch } = renderButton();
    fireEvent.click(screen.getByRole('button', { name: 'Share project' }));
    await waitFor(() => expect(screen.getByLabelText('Secret share link')).toBeInTheDocument());
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('a hide-completed share re-seeds its toggles — no phantom dirty, no silent re-expose (#823/P2)', async () => {
    const { shareContent } = await import('@/domain/shareContent');
    const opts = { includeDue: true, includeStatus: false, includeNotes: true, includeDone: false, salt: 'tok123', publishedAt: 'x' };
    const published = shareContent(doc, 'trip', opts)!;
    service.fetchShare.mockResolvedValue({ token: 'tok123', share_id: 'sid1', project_id: 'trip', content: published, enabled: true, updated_at: 'x' });
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: 'Share project' }));
    await waitFor(() => expect(screen.getByLabelText('Secret share link')).toBeInTheDocument());
    const boxes = screen.getAllByRole('checkbox');
    expect((boxes[3] as HTMLInputElement).checked).toBe(true); // Hide completed re-seeded ON
    expect(screen.queryByText(/changed since the last publish/)).not.toBeInTheDocument(); // not dirty
  });

  it('the guests-can\'t-see-yet cue counts what a republish would reveal (#821/F3)', async () => {
    // Stored snapshot has NO items; the doc has one includable item (a1; p1 is private).
    service.fetchShare.mockResolvedValue({ token: 'tok123', share_id: 'sid1', project_id: 'trip', content: { version: 1, title: 'Asia trip', publishedAt: 'x', items: [], sections: [] }, enabled: true, updated_at: 'x' });
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: 'Share project' }));
    await waitFor(() => expect(screen.getByText(/1 item\(s\) guests can’t see yet/)).toBeInTheDocument());
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
