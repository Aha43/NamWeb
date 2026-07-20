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
import { DRAINABLE_KINDS } from './shares';

function node(id: string, p: Partial<NamNode> = {}): NamNode {
  return {
    id, title: id, description: null, status: 'BACKLOG', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...p,
  };
}

/** A committed doc with one delegated COUNT on a1[0]; `ledger` seeds a1's drainLedger. */
function docWith(ledger: number[]): WorkspaceDocument {
  return {
    formatVersion: 1, rootNodeId: 'root', inboxNodeId: 'inbox', projectsNodeId: 'projects', nextActionsNodeId: 'actions',
    nodes: {
      root: node('root', { childIds: ['inbox', 'projects', 'actions'] }),
      inbox: node('inbox'),
      projects: node('projects', { childIds: ['trip'] }),
      actions: node('actions'),
      trip: node('trip', { project: true, childIds: ['a1'] }),
      a1: node('a1', {
        resources: [{ type: 'COUNT', value: '0/12', description: 'jars', guestEditable: true }],
        ...(ledger.length ? { drainLedger: { 0: ledger } } : {}),
      }),
    },
    registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
  };
}

const SHARE = { share_id: 'sid1', project_id: 'trip', token: 'tok123' };
const pseudoA1 = [...guestIdMap(docWith([]), 'trip', 'tok123').entries()].find(([, r]) => r === 'a1')![0];
const ev = (id: number, res_index = 0) => ({ id, node_id: pseudoA1, res_index, delta: 1, answer: null });

function baseMocks() {
  service.claimDrainableEvents.mockReset();
  service.deleteEvents.mockReset().mockResolvedValue(undefined);
  service.fetchLeftoverDrained.mockReset().mockResolvedValue([]);
}

/**
 * Models the real write path against the COMMITTED doc: an apply dispatch records its event id as
 * durably landed (unless `land(id)` is false — a failed write); `pruneDrainLedger` forgets ids;
 * `getCommittedDocument` reflects the ledger. `preLanded` seeds a prior session's applied ids.
 */
function harness(opts: { preLanded?: number[]; land?: (id: number) => boolean; committed?: () => WorkspaceDocument | null } = {}) {
  const landed = new Set<number>(opts.preLanded ?? []);
  const land = opts.land ?? (() => true);
  const applied: number[] = [];
  const pruned: number[] = [];
  const dispatch = vi.fn((intent: Intent) => {
    if (intent.type === 'pruneDrainLedger') {
      for (const e of intent.entries) for (const id of e.eventIds) { landed.delete(id); pruned.push(id); }
      return;
    }
    if (intent.type !== 'incrementCountResource' && intent.type !== 'answerQuestionResource') return;
    applied.push(intent.eventId!);
    if (land(intent.eventId!)) landed.add(intent.eventId!);
  });
  const getCommittedDocument = opts.committed ?? (() => docWith([...landed]));
  const flush = vi.fn(async () => true);
  return { dispatch, getCommittedDocument, flush, applied, pruned };
}

describe('drainShare (#832/#850) — restartable, ledger-durable, committed-truth drain', () => {
  it('dispatches a claimed event, deletes it once durably applied, and tombstones its ledger id', async () => {
    baseMocks();
    service.claimDrainableEvents.mockResolvedValue([ev(7)]);
    const h = harness();
    await drainShare(h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    expect(service.claimDrainableEvents).toHaveBeenCalledWith('sid1', DRAINABLE_KINDS);
    expect(h.applied).toEqual([7]);
    expect(service.deleteEvents).toHaveBeenCalledWith([7]);
    expect(h.pruned).toEqual([7]); // tombstone GC: forget exactly the deleted id
  });

  it('dispatches in id order even when the claim returns rows unsorted (the FIFO the ledger needs)', async () => {
    baseMocks();
    service.claimDrainableEvents.mockResolvedValue([ev(9), ev(7), ev(8)]);
    const h = harness();
    await drainShare(h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    expect(h.applied).toEqual([7, 8, 9]);
  });

  it('P1#2: an applicable event that did NOT land is LEFT CLAIMED, never deleted as junk', async () => {
    baseMocks();
    // The write fails → 7 never enters the committed ledger. It is still PLANNABLE against the
    // committed doc (the resource exists), so it must NOT be mistaken for junk and deleted.
    service.claimDrainableEvents.mockResolvedValue([ev(7)]);
    const h = harness({ land: () => false });
    await drainShare(h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    expect(h.applied).toEqual([7]); // it was dispatched…
    expect(service.deleteEvents).not.toHaveBeenCalled(); // …but never deleted (left claimed)
    expect(h.pruned).toEqual([]);
  });

  it('P1#2: a resource removed only OPTIMISTICALLY (committed still has it) keeps the event claimed', async () => {
    baseMocks();
    // getCommittedDocument always returns the doc WITH the delegated resource — modelling a failed
    // optimistic removal. The event stays plannable against committed, so it is not junk-deleted.
    service.claimDrainableEvents.mockResolvedValue([ev(7)]);
    const h = harness({ land: () => false, committed: () => docWith([]) });
    await drainShare(h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    expect(service.deleteEvents).not.toHaveBeenCalled();
  });

  it('P1#1: pruning is a tombstone of DELETED ids, never a floor — a non-landed lower id survives', async () => {
    baseMocks();
    // 3 fails to land; 7 and 9 apply. 3 is a lower id than the applied ones — a min-floor prune would
    // have evicted it. Tombstone GC forgets ONLY 7 and 9 (deleted), and leaves 3 claimed.
    service.fetchLeftoverDrained.mockResolvedValue([ev(3)]);
    service.claimDrainableEvents.mockResolvedValue([ev(7), ev(9)]);
    const h = harness({ land: (id) => id !== 3 });
    await drainShare(h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    expect(service.deleteEvents).toHaveBeenCalledWith([7, 9]); // 3 NOT deleted
    expect(h.pruned).toEqual([7, 9]); // 3 NOT pruned — no floor eviction
  });

  it('DELETES a junk event (no intent vs the committed doc) without applying or tombstoning it', async () => {
    baseMocks();
    // res_index 9 resolves to a1 but has no resource → not plannable → junk → delete, never applied.
    service.claimDrainableEvents.mockResolvedValue([ev(9, 9)]);
    const h = harness();
    await drainShare(h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    expect(h.applied).toEqual([]);
    expect(service.deleteEvents).toHaveBeenCalledWith([9]);
    expect(h.pruned).toEqual([]); // junk was never in a ledger — no tombstone
  });

  it('restartable: a leftover ALREADY in the committed ledger is deleted WITHOUT re-dispatching', async () => {
    baseMocks();
    service.claimDrainableEvents.mockResolvedValue([]);
    service.fetchLeftoverDrained.mockResolvedValue([ev(7)]); // claimed last session, applied durably
    const h = harness({ preLanded: [7] });
    await drainShare(h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    expect(h.applied).toEqual([]); // idempotent skip — no redundant version-bumping push
    expect(service.deleteEvents).toHaveBeenCalledWith([7]);
    expect(h.pruned).toEqual([7]);
  });

  it('restartable: a leftover NOT yet applied is re-processed (dispatched) then deleted', async () => {
    baseMocks();
    service.claimDrainableEvents.mockResolvedValue([]);
    service.fetchLeftoverDrained.mockResolvedValue([ev(7)]); // claimed but never landed (crash)
    const h = harness();
    await drainShare(h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    expect(h.applied).toEqual([7]);
    expect(service.deleteEvents).toHaveBeenCalledWith([7]);
  });

  it('does NOT tombstone when the delete RPC fails (rows still there → re-process next drain)', async () => {
    baseMocks();
    service.claimDrainableEvents.mockResolvedValue([ev(7)]);
    service.deleteEvents.mockRejectedValue(new Error('network'));
    const h = harness();
    const resolved = await drainShare(h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    expect(resolved).toBe(0);
    expect(h.pruned).toEqual([]); // never forget an id whose row deletion we didn't confirm
  });

  it('a lost claim (other device won the split) with no leftovers touches nothing', async () => {
    baseMocks();
    service.claimDrainableEvents.mockResolvedValue([]);
    const h = harness();
    expect(await drainShare(h.getCommittedDocument, h.dispatch, h.flush, SHARE)).toBe(0);
    expect(h.applied).toEqual([]);
    expect(service.deleteEvents).not.toHaveBeenCalled();
  });

  it('returns 0 when there is no committed document to plan against', async () => {
    baseMocks();
    service.claimDrainableEvents.mockResolvedValue([ev(7)]);
    const h = harness({ committed: () => null });
    expect(await drainShare(h.getCommittedDocument, h.dispatch, h.flush, SHARE)).toBe(0);
    expect(h.applied).toEqual([]);
    expect(service.deleteEvents).not.toHaveBeenCalled();
  });
});
