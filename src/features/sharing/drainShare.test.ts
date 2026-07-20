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

/** A committed doc with one delegated COUNT on a1[0]; `ledger` seeds a1.drainLedger[0]. */
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
  service.claimDrainableEvents.mockReset().mockResolvedValue([]);
  service.deleteEvents.mockReset().mockResolvedValue(undefined);
  service.fetchLeftoverDrained.mockReset().mockResolvedValue([]);
}

/**
 * Models the committed write path: an apply dispatch, if it lands, records its event id in a1's
 * ledger; `getCommittedDocument` reflects it. `preLanded` seeds a prior session's applied ids; `land`
 * can block a write (a failed commit); `committed` overrides the doc entirely.
 */
function harness(opts: { preLanded?: number[]; land?: (id: number) => boolean; committed?: () => WorkspaceDocument | null } = {}) {
  const landed = new Set<number>(opts.preLanded ?? []);
  const land = opts.land ?? (() => true);
  const applied: number[] = [];
  const dispatch = vi.fn((intent: Intent) => {
    if (intent.type !== 'incrementCountResource' && intent.type !== 'answerQuestionResource') return;
    applied.push(intent.eventId!);
    if (land(intent.eventId!)) landed.add(intent.eventId!);
  });
  const getCommittedDocument = opts.committed ?? (() => docWith([...landed]));
  const flush = vi.fn(async () => true);
  return { dispatch, getCommittedDocument, flush, applied };
}

describe('drainShare (#832/#850) — append-only ledger, restartable, committed-truth drain', () => {
  it('dispatches a claimed event and deletes it once its id is in the committed ledger', async () => {
    baseMocks();
    service.claimDrainableEvents.mockResolvedValue([ev(7)]);
    const h = harness();
    await drainShare(h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    expect(service.claimDrainableEvents).toHaveBeenCalledWith('sid1', DRAINABLE_KINDS);
    expect(h.applied).toEqual([7]);
    expect(service.deleteEvents).toHaveBeenCalledWith([7]);
  });

  it('dispatches in id order even when the claim returns rows unsorted (−1,+1 must land in order)', async () => {
    baseMocks();
    service.claimDrainableEvents.mockResolvedValue([ev(9), ev(7), ev(8)]);
    const h = harness();
    await drainShare(h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    expect(h.applied).toEqual([7, 8, 9]);
  });

  it('a leftover already in the committed ledger is deleted WITHOUT re-dispatching (idempotent)', async () => {
    baseMocks();
    service.fetchLeftoverDrained.mockResolvedValue([ev(7)]); // applied last session, delete failed
    const h = harness({ preLanded: [7] });
    await drainShare(h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    expect(h.applied).toEqual([]); // 7 ∈ ledger → never re-applied
    expect(service.deleteEvents).toHaveBeenCalledWith([7]);
  });

  it('P1#2: an applicable event that did NOT land is LEFT CLAIMED, never deleted as junk', async () => {
    baseMocks();
    // The write fails → 7 never enters the committed ledger. It is still PLANNABLE against the
    // committed doc (the resource exists), so it must NOT be mistaken for junk and deleted.
    service.claimDrainableEvents.mockResolvedValue([ev(7)]);
    const h = harness({ land: () => false });
    await drainShare(h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    expect(h.applied).toEqual([7]); // dispatched…
    expect(service.deleteEvents).not.toHaveBeenCalled(); // …but never deleted (left claimed)
  });

  it('P1#2: a resource removed only OPTIMISTICALLY (committed still has it) keeps the event claimed', async () => {
    baseMocks();
    service.claimDrainableEvents.mockResolvedValue([ev(7)]);
    const h = harness({ land: () => false, committed: () => docWith([]) });
    await drainShare(h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    expect(service.deleteEvents).not.toHaveBeenCalled();
  });

  it('DELETES a junk event (no intent vs the committed doc) without applying it', async () => {
    baseMocks();
    service.claimDrainableEvents.mockResolvedValue([ev(9, 9)]); // res_index 9 has no resource → junk
    const h = harness();
    await drainShare(h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    expect(h.applied).toEqual([]);
    expect(service.deleteEvents).toHaveBeenCalledWith([9]);
  });

  it('restartable: a leftover NOT yet applied is re-processed (dispatched) then deleted', async () => {
    baseMocks();
    service.fetchLeftoverDrained.mockResolvedValue([ev(7)]); // claimed but never landed (crash)
    const h = harness();
    await drainShare(h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    expect(h.applied).toEqual([7]);
    expect(service.deleteEvents).toHaveBeenCalledWith([7]);
  });

  it('a failed leftover fetch still claims and processes the fresh events (no completeness gate)', async () => {
    baseMocks();
    service.fetchLeftoverDrained.mockRejectedValue(new Error('network'));
    service.claimDrainableEvents.mockResolvedValue([ev(7)]);
    const h = harness();
    await drainShare(h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    expect(service.claimDrainableEvents).toHaveBeenCalled();
    expect(h.applied).toEqual([7]);
    expect(service.deleteEvents).toHaveBeenCalledWith([7]);
  });

  it('on a delete-RPC failure it resolves 0 — rows stay, re-processed idempotently next drain', async () => {
    baseMocks();
    service.claimDrainableEvents.mockResolvedValue([ev(7)]);
    service.deleteEvents.mockRejectedValue(new Error('network'));
    const h = harness();
    expect(await drainShare(h.getCommittedDocument, h.dispatch, h.flush, SHARE)).toBe(0);
  });

  it('a lost claim (other device won the split) with no leftovers touches nothing', async () => {
    baseMocks();
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
