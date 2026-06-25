import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkspaceDocument } from '../domain/types';

// Module seams. The reconcile path is the unit under test: a Realtime signal
// re-pulls and adopts only a strictly-newer snapshot when no write is in flight.
const pull = vi.fn();
const commitIntent = vi.fn();
const getSession = vi.fn();
let capturedSignal: (() => void) | null = null;

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: (...a: unknown[]) => getSession(...a) },
    realtime: { setAuth: vi.fn() },
  },
}));
vi.mock('../lib/workspace', () => ({ getWorkspaceName: () => 'dev' }));
vi.mock('../sync/workspaceClient', () => ({ pull: (...a: unknown[]) => pull(...a) }));
vi.mock('../sync/realtime', () => ({
  subscribeToWorkspace: (_c: unknown, _uid: unknown, onSignal: () => void) => {
    capturedSignal = onSignal;
    return () => {};
  },
}));
vi.mock('./commit', () => ({ commitIntent: (...a: unknown[]) => commitIntent(...a) }));
// Identity apply so optimistic updates don't need real domain docs.
vi.mock('../domain/mutations', () => ({ applyIntent: (doc: unknown) => doc }));

import { useWorkspace } from './useWorkspace';

const doc = (tag: string) => ({ tag } as unknown as WorkspaceDocument);

beforeEach(() => {
  vi.clearAllMocks();
  capturedSignal = null;
  getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
});

/** Render, wait for the initial load and the Realtime subscription to be wired. */
async function mountLoaded(initial: { tag: string; version: number }) {
  pull.mockResolvedValueOnce({ kind: 'ok', document: doc(initial.tag), version: initial.version });
  const view = renderHook(() => useWorkspace());
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  await waitFor(() => expect(capturedSignal).not.toBeNull());
  return view;
}

describe('useWorkspace — Realtime signal-then-pull', () => {
  it('adopts a strictly-newer remote snapshot on signal', async () => {
    const view = await mountLoaded({ tag: 'v1', version: 1 });
    expect((view.result.current.document as unknown as { tag: string }).tag).toBe('v1');

    pull.mockResolvedValueOnce({ kind: 'ok', document: doc('v2'), version: 2 });
    capturedSignal!();

    await waitFor(() =>
      expect((view.result.current.document as unknown as { tag: string }).tag).toBe('v2'),
    );
    expect(view.result.current.notice).toEqual({ kind: 'info', message: 'Updated from another device.' });
  });

  it('ignores an echo at the same version', async () => {
    const view = await mountLoaded({ tag: 'v1', version: 1 });

    pull.mockResolvedValueOnce({ kind: 'ok', document: doc('echo'), version: 1 });
    capturedSignal!();
    await waitFor(() => expect(pull).toHaveBeenCalledTimes(2)); // initial + reconcile

    expect((view.result.current.document as unknown as { tag: string }).tag).toBe('v1');
    expect(view.result.current.notice).toBeNull();
  });

  it('skips reconciliation while a local write is in flight', async () => {
    const view = await mountLoaded({ tag: 'v1', version: 1 });

    // A commit that never settles keeps the in-flight count > 0.
    commitIntent.mockReturnValue(new Promise(() => {}));
    await act(async () => {
      view.result.current.dispatch({ type: 'noop' } as never);
      capturedSignal!();
      await Promise.resolve();
    });

    // Reconcile bailed before pulling — only the initial load hit the network.
    expect(pull).toHaveBeenCalledTimes(1);
    expect(view.result.current.notice).toBeNull();
  });
});
