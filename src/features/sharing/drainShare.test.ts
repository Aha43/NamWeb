import { describe, expect, it, vi } from 'vitest';
import type { Intent } from '@/domain/mutations';
import type { NamNode, WorkspaceDocument } from '@/domain/types';
import { guestIdMap } from '@/domain/shareContent';

const service = {
  claimDrainableEvents: vi.fn(),
  deleteEvents: vi.fn(),
  fetchLeftoverDrained: vi.fn(),
};
vi.mock('./shares', async (orig) => ({
  ...(await orig<typeof import('./shares')>()),
  claimDrainableEvents: (...a: unknown[]) => service.claimDrainableEvents(...a),
  deleteEvents: (...a: unknown[]) => service.deleteEvents(...a),
  fetchLeftoverDrained: (...a: unknown[]) => service.fetchLeftoverDrained(...a),
}));

import { drainShare } from './drainShare';
import { DRAINABLE_KINDS, DRAIN_LEFTOVER_LIMIT } from './shares';

function node(id: string, p: Partial<NamNode> = {}): NamNode {
  return {
    id, title: id, description: null, status: 'BACKLOG', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...p,
  };
}

/** A doc with one delegated COUNT on a1[0]; `ledger` seeds a1's drainLedger (the applied ids). */
function docWith(value: string, ledger?: number[]): WorkspaceDocument {
  return {
    formatVersion: 1, rootNodeId: 'root', inboxNodeId: 'inbox', projectsNodeId: 'projects', nextActionsNodeId: 'actions',
    nodes: {
      root: node('root', { childIds: ['inbox', 'projects', 'actions'] }),
      inbox: node('inbox'),
      projects: node('projects', { childIds: ['trip'] }),
      actions: node('actions'),
      trip: node('trip', { project: true, childIds: ['a1'] }),
      a1: node('a1', {
        resources: [{ type: 'COUNT', value, description: 'jars', guestEditable: true }],
        ...(ledger ? { drainLedger: { 0: ledger } } : {}),
      }),
    },
    registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
  };
}

const SHARE = { share_id: 'sid1', project_id: 'trip', token: 'tok123' };
const pseudoA1 = [...guestIdMap(docWith('0/12'), 'trip', 'tok123').entries()].find(([, r]) => r === 'a1')![0];
const ev = (id: number, delta: 1 | -1 = 1) => ({ id, node_id: pseudoA1, res_index: 0, delta, answer: null });

function baseMocks() {
  service.claimDrainableEvents.mockReset();
  service.deleteEvents.mockReset().mockResolvedValue(undefined);
  service.fetchLeftoverDrained.mockReset().mockResolvedValue([]);
}

/**
 * A harness modelling the real write path: `dispatch` records each intent's event id as durably
 * landed (a successful commit), and `getCommittedDocument` reflects those ids in a1's ledger. A
 * test can pre-seed `landed` (a prior session that already applied) or block a dispatch from
 * landing (a failed write) to exercise every branch.
 */
function harness(opts: { preLanded?: number[]; land?: (id: number) => boolean } = {}) {
  const landed = new Set<number>(opts.preLanded ?? []);
  const land = opts.land ?? (() => true);
  const dispatchOrder: number[] = [];
  const dispatch = vi.fn((intent: Intent) => {
    if (intent.type !== 'incrementCountResource' && intent.type !== 'answerQuestionResource') return;
    dispatchOrder.push(intent.eventId!);
    if (land(intent.eventId!)) landed.add(intent.eventId!);
  });
  const getCommittedDocument = () => docWith('0/12', [...landed]);
  const flush = vi.fn(async () => true);
  return { dispatch, getCommittedDocument, flush, dispatchOrder };
}

describe('drainShare (#832/#850) — restartable, ledger-durable drain', () => {
  it('dispatches a claimed event, then deletes it once its id is in the committed ledger', async () => {
    baseMocks();
    service.claimDrainableEvents.mockResolvedValue([ev(7)]);
    const h = harness();
    await drainShare(() => docWith('10/12'), h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    expect(service.claimDrainableEvents).toHaveBeenCalledWith('sid1', DRAINABLE_KINDS);
    expect(h.dispatch).toHaveBeenCalledWith(expect.objectContaining({ eventId: 7 }));
    expect(service.deleteEvents).toHaveBeenCalledWith([7]);
  });

  it('dispatches in id order even when the claim returns rows unsorted (the FIFO the ledger needs)', async () => {
    baseMocks();
    service.claimDrainableEvents.mockResolvedValue([ev(9), ev(7), ev(8)]);
    const h = harness();
    await drainShare(() => docWith('10/12'), h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    expect(h.dispatchOrder).toEqual([7, 8, 9]);
  });

  it('threads pruneBelow = the smallest working-set id onto every intent for that resource', async () => {
    baseMocks();
    service.claimDrainableEvents.mockResolvedValue([ev(7), ev(9)]);
    const h = harness();
    await drainShare(() => docWith('10/12'), h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    for (const call of h.dispatch.mock.calls) expect(call[0]).toMatchObject({ pruneBelow: 7 });
  });

  it('SKIPS pruning (pruneBelow undefined) when the leftover fetch FAILS — never evict a possibly-live id', async () => {
    baseMocks();
    // A failed leftover fetch means the working set may be missing an older still-existing leftover;
    // pruning its id from the ledger would let it double-apply. So no eviction this pass (#850 review).
    service.fetchLeftoverDrained.mockRejectedValue(new Error('network hiccup'));
    service.claimDrainableEvents.mockResolvedValue([ev(9)]);
    const h = harness();
    await drainShare(() => docWith('10/12'), h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    expect((h.dispatch.mock.calls[0][0] as { eventId?: number; pruneBelow?: number }).eventId).toBe(9);
    expect((h.dispatch.mock.calls[0][0] as { pruneBelow?: number }).pruneBelow).toBeUndefined();
  });

  it('SKIPS pruning when the leftover fetch returns a FULL PAGE (possible truncation)', async () => {
    baseMocks();
    // A full page of leftovers (on unrelated resources) signals the fetch may be truncated → the
    // working set is possibly incomplete → do not prune.
    service.fetchLeftoverDrained.mockResolvedValue(
      Array.from({ length: DRAIN_LEFTOVER_LIMIT }, (_, i) => ({ id: i + 1, node_id: 'zzzzzzzz', res_index: 0, delta: 1, answer: null })),
    );
    service.claimDrainableEvents.mockResolvedValue([ev(5000)]);
    const h = harness();
    await drainShare(() => docWith('10/12'), h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    const a1 = h.dispatch.mock.calls.find((c) => (c[0] as { eventId?: number }).eventId === 5000)!;
    expect((a1[0] as { pruneBelow?: number }).pruneBelow).toBeUndefined();
  });

  it('LEAVES CLAIMED an event whose write did NOT land (never in the committed ledger)', async () => {
    baseMocks();
    service.claimDrainableEvents.mockResolvedValue([ev(7)]);
    const h = harness({ land: () => false }); // the commit failed — 7 never reaches the ledger
    await drainShare(() => docWith('10/12'), h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    expect(h.dispatch).toHaveBeenCalled();
    expect(service.deleteEvents).not.toHaveBeenCalled(); // NEVER delete an event that didn't apply
  });

  it('DELETES a junk event (no intent produced) without dispatching it', async () => {
    baseMocks();
    // res_index 9 has no resource → drainPlan drops it → structural junk → delete, never dispatch.
    service.claimDrainableEvents.mockResolvedValue([{ id: 9, node_id: pseudoA1, res_index: 9, delta: 1, answer: null }]);
    const h = harness();
    await drainShare(() => docWith('10/12'), h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    expect(h.dispatch).not.toHaveBeenCalled();
    expect(service.deleteEvents).toHaveBeenCalledWith([9]);
  });

  it('restartable: a leftover ALREADY in the committed ledger is deleted WITHOUT re-dispatching', async () => {
    baseMocks();
    service.claimDrainableEvents.mockResolvedValue([]);
    service.fetchLeftoverDrained.mockResolvedValue([ev(7)]); // claimed last session, applied durably
    const h = harness({ preLanded: [7] }); // its id is already in the committed ledger
    await drainShare(() => docWith('11/12'), h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    expect(h.dispatch).not.toHaveBeenCalled(); // idempotent skip — no redundant version-bumping push
    expect(service.deleteEvents).toHaveBeenCalledWith([7]);
  });

  it('restartable: a leftover NOT yet applied is re-processed (dispatched) then deleted', async () => {
    baseMocks();
    service.claimDrainableEvents.mockResolvedValue([]);
    service.fetchLeftoverDrained.mockResolvedValue([ev(7)]); // claimed but never landed (crash)
    const h = harness();
    await drainShare(() => docWith('10/12'), h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    expect(h.dispatch).toHaveBeenCalledWith(expect.objectContaining({ eventId: 7 }));
    expect(service.deleteEvents).toHaveBeenCalledWith([7]);
  });

  it('a lost claim (other device won the split) with no leftovers touches nothing', async () => {
    baseMocks();
    service.claimDrainableEvents.mockResolvedValue([]);
    const h = harness();
    expect(await drainShare(() => docWith('10/12'), h.getCommittedDocument, h.dispatch, h.flush, SHARE)).toBe(0);
    expect(h.dispatch).not.toHaveBeenCalled();
    expect(service.deleteEvents).not.toHaveBeenCalled();
  });

  it('returns 0 when the live document is unavailable (nothing lost — retried next trigger)', async () => {
    baseMocks();
    service.claimDrainableEvents.mockResolvedValue([ev(7)]);
    const h = harness();
    expect(await drainShare(() => null, h.getCommittedDocument, h.dispatch, h.flush, SHARE)).toBe(0);
    expect(h.dispatch).not.toHaveBeenCalled();
  });
});
