import { describe, expect, it, vi } from 'vitest';
import type { Intent } from '@/domain/mutations';
import type { NamNode, WorkspaceDocument } from '@/domain/types';
import { guestIdMap } from '@/domain/shareContent';

const service = {
  claimDrainableEvents: vi.fn(),
  deleteEvents: vi.fn(),
  fetchLeftoverDrained: vi.fn(),
  acquireDrainLease: vi.fn(),
  releaseDrainLease: vi.fn(),
};
vi.mock('./shares', async (orig) => ({
  ...(await orig<typeof import('./shares')>()),
  claimDrainableEvents: (...a: unknown[]) => service.claimDrainableEvents(...a),
  deleteEvents: (...a: unknown[]) => service.deleteEvents(...a),
  fetchLeftoverDrained: (...a: unknown[]) => service.fetchLeftoverDrained(...a),
  acquireDrainLease: (...a: unknown[]) => service.acquireDrainLease(...a),
  releaseDrainLease: (...a: unknown[]) => service.releaseDrainLease(...a),
}));

import { drainShare } from './drainShare';
import { DRAIN_LEFTOVER_LIMIT } from './shares';

function node(id: string, p: Partial<NamNode> = {}): NamNode {
  return {
    id, title: id, description: null, status: 'BACKLOG', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...p,
  };
}

/** A committed doc with one delegated COUNT on a1[0]; `watermark` seeds a1.drainedThrough[0]. */
function docWith(watermark?: number): WorkspaceDocument {
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
        ...(watermark ? { drainedThrough: { 0: watermark } } : {}),
      }),
    },
    registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
  };
}

const SHARE = { share_id: 'sid1', project_id: 'trip', token: 'tok123' };
const pseudoA1 = [...guestIdMap(docWith(), 'trip', 'tok123').entries()].find(([, r]) => r === 'a1')![0];
const ev = (id: number, res_index = 0) => ({ id, node_id: pseudoA1, res_index, delta: 1, answer: null });

function baseMocks() {
  service.claimDrainableEvents.mockReset().mockResolvedValue([]);
  service.deleteEvents.mockReset().mockResolvedValue(undefined);
  service.fetchLeftoverDrained.mockReset().mockResolvedValue([]);
  service.acquireDrainLease.mockReset().mockResolvedValue('lease-token'); // held by default
  service.releaseDrainLease.mockReset().mockResolvedValue(undefined);
}

/**
 * Models the committed write path: an apply dispatch, if it lands, advances a1's watermark to the
 * highest landed id; `getCommittedDocument` reflects it. `preLanded` seeds a prior session's high
 * watermark; `land` can block a write (a failed commit); `committed` overrides the doc entirely.
 */
function harness(opts: { preLanded?: number; land?: (id: number) => boolean; committed?: () => WorkspaceDocument | null } = {}) {
  let watermark = opts.preLanded ?? 0;
  const land = opts.land ?? (() => true);
  const applied: number[] = [];
  const dispatch = vi.fn((intent: Intent) => {
    if (intent.type !== 'incrementCountResource' && intent.type !== 'answerQuestionResource') return;
    applied.push(intent.eventId!);
    if (land(intent.eventId!)) watermark = Math.max(watermark, intent.eventId!);
  });
  const getCommittedDocument = opts.committed ?? (() => docWith(watermark || undefined));
  const flush = vi.fn(async () => true);
  return { dispatch, getCommittedDocument, flush, applied };
}

describe('drainShare (#832/#850/#852) — lease-serialized, watermark, committed-truth drain', () => {
  it('acquires the lease, drains, then releases it', async () => {
    baseMocks();
    service.claimDrainableEvents.mockResolvedValue([ev(7)]);
    const h = harness();
    await drainShare(h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    expect(service.acquireDrainLease).toHaveBeenCalledWith('sid1', expect.any(Number));
    expect(h.applied).toEqual([7]);
    expect(service.deleteEvents).toHaveBeenCalledWith([7]);
    expect(service.releaseDrainLease).toHaveBeenCalledWith('sid1', 'lease-token');
  });

  it('SKIPS entirely when another tab holds the lease (acquire returns null) — no claim, no release', async () => {
    baseMocks();
    service.acquireDrainLease.mockResolvedValue(null);
    service.claimDrainableEvents.mockResolvedValue([ev(7)]);
    const h = harness();
    expect(await drainShare(h.getCommittedDocument, h.dispatch, h.flush, SHARE)).toBe(0);
    expect(service.claimDrainableEvents).not.toHaveBeenCalled();
    expect(h.applied).toEqual([]);
    expect(service.releaseDrainLease).not.toHaveBeenCalled();
  });

  it('releases the lease even if the drain throws', async () => {
    baseMocks();
    service.claimDrainableEvents.mockRejectedValue(new Error('boom'));
    const h = harness();
    await expect(drainShare(h.getCommittedDocument, h.dispatch, h.flush, SHARE)).rejects.toThrow();
    expect(service.releaseDrainLease).toHaveBeenCalledWith('sid1', 'lease-token');
  });

  it('dispatches a claimed event and deletes it once its id is at/under the committed watermark', async () => {
    baseMocks();
    service.claimDrainableEvents.mockResolvedValue([ev(7)]);
    const h = harness();
    await drainShare(h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    expect(h.applied).toEqual([7]);
    expect(service.deleteEvents).toHaveBeenCalledWith([7]);
  });

  it('dispatches in id order even when the claim returns rows unsorted', async () => {
    baseMocks();
    service.claimDrainableEvents.mockResolvedValue([ev(9), ev(7), ev(8)]);
    const h = harness();
    await drainShare(h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    expect(h.applied).toEqual([7, 8, 9]);
  });

  it('idempotent: a leftover already under the committed watermark is deleted WITHOUT re-dispatching', async () => {
    baseMocks();
    service.fetchLeftoverDrained.mockResolvedValue([ev(7)]); // applied last session, delete failed
    const h = harness({ preLanded: 7 });
    await drainShare(h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    expect(h.applied).toEqual([]); // 7 ≤ watermark → never re-applied
    expect(service.deleteEvents).toHaveBeenCalledWith([7]);
  });

  it('P1#2: an applicable event that did NOT land is LEFT CLAIMED, never deleted as junk', async () => {
    baseMocks();
    service.claimDrainableEvents.mockResolvedValue([ev(7)]);
    const h = harness({ land: () => false });
    await drainShare(h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    expect(h.applied).toEqual([7]); // dispatched…
    expect(service.deleteEvents).not.toHaveBeenCalled(); // …but never deleted (left claimed)
  });

  it('DELETES a junk event (no intent vs the committed doc) without applying it', async () => {
    baseMocks();
    service.claimDrainableEvents.mockResolvedValue([ev(9, 9)]); // res_index 9 has no resource → junk
    const h = harness();
    await drainShare(h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    expect(h.applied).toEqual([]);
    expect(service.deleteEvents).toHaveBeenCalledWith([9]);
  });

  it('DEFERS claiming new events when the leftover fetch FAILS (watermark loss-safety)', async () => {
    baseMocks();
    service.fetchLeftoverDrained.mockRejectedValue(new Error('network'));
    const h = harness();
    expect(await drainShare(h.getCommittedDocument, h.dispatch, h.flush, SHARE)).toBe(0);
    expect(service.claimDrainableEvents).not.toHaveBeenCalled();
    expect(h.applied).toEqual([]);
  });

  it('DEFERS claiming when the leftover page is FULL (possible truncation); drains the page only', async () => {
    baseMocks();
    service.fetchLeftoverDrained.mockResolvedValue(
      Array.from({ length: DRAIN_LEFTOVER_LIMIT }, (_, i) => ({ id: i + 1, node_id: 'zzzzzzzz', res_index: 0, delta: 1, answer: null })),
    );
    const h = harness();
    await drainShare(h.getCommittedDocument, h.dispatch, h.flush, SHARE);
    expect(service.claimDrainableEvents).not.toHaveBeenCalled();
    expect(service.deleteEvents).toHaveBeenCalled(); // the junk page is swept
  });

  it('on a delete-RPC failure it resolves 0 — rows stay, re-processed idempotently next drain', async () => {
    baseMocks();
    service.claimDrainableEvents.mockResolvedValue([ev(7)]);
    service.deleteEvents.mockRejectedValue(new Error('network'));
    const h = harness();
    expect(await drainShare(h.getCommittedDocument, h.dispatch, h.flush, SHARE)).toBe(0);
    expect(service.releaseDrainLease).toHaveBeenCalled(); // lease still released
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
