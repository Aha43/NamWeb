import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceDocument } from '../domain/types';

// #484 — a failed write must keep the optimistic edit visible and recoverable: Retry re-pushes the
// LOCAL (edited) document, and a successful retry never "recovers" the unchanged confirmed base.

const pull = vi.fn();
const push = vi.fn();
const commitIntent = vi.fn();
const getSession = vi.fn();

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: (...a: unknown[]) => getSession(...a) },
    realtime: { setAuth: vi.fn() },
  },
}));
vi.mock('../lib/workspace', () => ({ getWorkspaceName: () => 'dev' }));
vi.mock('../sync/workspaceClient', () => ({
  pull: (...a: unknown[]) => pull(...a),
  push: (...a: unknown[]) => push(...a),
}));
vi.mock('../sync/realtime', () => ({ subscribeToWorkspace: () => () => {} }));
vi.mock('./commit', () => ({ commitIntent: (...a: unknown[]) => commitIntent(...a) }));
// A transforming apply so we can observe whether the optimistic edit survives.
vi.mock('../domain/mutations', () => ({
  applyIntent: (doc: { content: string }, intent: { add: string }) => ({ content: doc.content + intent.add }),
}));

import { useWorkspace } from './useWorkspace';

const content = (view: { result: { current: { document: WorkspaceDocument | null } } }) =>
  (view.result.current.document as unknown as { content: string } | null)?.content;

beforeEach(() => {
  vi.clearAllMocks();
  getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
});

async function mountLoaded() {
  pull.mockResolvedValueOnce({ kind: 'ok', document: { content: 'base' }, version: 1 });
  const view = renderHook(() => useWorkspace());
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  return view;
}

describe('useWorkspace — failed write recovery (#484)', () => {
  it('keeps the optimistic edit after a failed push, then Retry re-pushes the edited document', async () => {
    const view = await mountLoaded();

    // The commit fails — commit.ts returns the confirmed base snapshot for an error.
    commitIntent.mockResolvedValueOnce({
      snapshot: { document: { content: 'base' }, version: 1 },
      outcome: 'error',
      message: 'network',
    });

    await act(async () => {
      view.result.current.dispatch({ add: 'X' } as never);
      await Promise.resolve();
    });

    // The edit stays visible (not reverted to 'base'), with a sticky error notice.
    await waitFor(() => expect(content(view)).toBe('baseX'));
    expect(view.result.current.notice).toEqual({ kind: 'error', messageKey: expect.any(String) });
    expect(view.result.current.notice?.kind).toBe('error');

    // Retry pushes the EDITED document, guarded on the last confirmed version (1).
    push.mockResolvedValueOnce({ kind: 'ok', version: 2 });
    await act(async () => {
      view.result.current.retrySync();
      await Promise.resolve();
    });

    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith(expect.anything(), 'dev', { content: 'baseX' }, 1);
    await waitFor(() => expect(view.result.current.notice).toBeNull());
    expect(content(view)).toBe('baseX');
  });

  it('a later edit after a failure does not erase the earlier one; Retry recovers both (#507)', async () => {
    const view = await mountLoaded();

    // First commit fails (edit X).
    commitIntent.mockResolvedValueOnce({
      snapshot: { document: { content: 'base' }, version: 1 },
      outcome: 'error',
      message: 'network',
    });
    await act(async () => {
      view.result.current.dispatch({ add: 'X' } as never);
      await Promise.resolve();
    });
    await waitFor(() => expect(content(view)).toBe('baseX'));

    // A second edit (Y) is dispatched while the failure is pending. Its commit must be SKIPPED
    // (not run against the stale base), so it can't overwrite X on success.
    await act(async () => {
      view.result.current.dispatch({ add: 'Y' } as never);
      await Promise.resolve();
    });
    expect(content(view)).toBe('baseXY'); // both edits visible
    expect(commitIntent).toHaveBeenCalledTimes(1); // Y's commit was paused, not attempted

    // Retry re-pushes the whole local doc — both edits — and recovers.
    push.mockResolvedValueOnce({ kind: 'ok', version: 2 });
    await act(async () => {
      view.result.current.retrySync();
      await Promise.resolve();
    });
    await waitFor(() => expect(push).toHaveBeenCalledWith(expect.anything(), 'dev', { content: 'baseXY' }, 1));
    await waitFor(() => expect(view.result.current.notice).toBeNull());
    expect(content(view)).toBe('baseXY');
  });
});
