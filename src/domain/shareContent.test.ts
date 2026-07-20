import { describe, expect, it } from 'vitest';
import type { NamNode, WorkspaceDocument } from './types';
import { shareContent, type ShareOptions } from './shareContent';

// The sanitizer is the sharing epic's security boundary — this suite is deliberately the
// heaviest in the epic. When adding document fields, the allowlist test below is the one
// that must keep you honest.

function node(id: string, p: Partial<NamNode> = {}): NamNode {
  return {
    id, title: id, description: null, status: 'BACKLOG', project: false,
    childIds: [], tags: [], blockedBy: [], resources: [],
    createdAt: null, updatedAt: null, statusChangedAt: null, dueAt: null, ...p,
  };
}

function workspace(extra: NamNode[], wire: Record<string, string[]> = {}): WorkspaceDocument {
  const nodes: Record<string, NamNode> = {
    root: node('root', { childIds: ['inbox', 'projects', 'actions'] }),
    inbox: node('inbox'),
    projects: node('projects', { childIds: ['trip'] }),
    actions: node('actions'),
  };
  for (const n of extra) nodes[n.id] = n;
  for (const [id, childIds] of Object.entries(wire)) nodes[id].childIds = childIds;
  return {
    formatVersion: 1, rootNodeId: 'root', inboxNodeId: 'inbox', projectsNodeId: 'projects', nextActionsNodeId: 'actions',
    nodes, registeredTags: [], savedViews: [], missionControls: [], templates: [], viewOrders: {},
  };
}

const OPTS: ShareOptions = {
  includeDue: true,
  includeStatus: false,
  includeNotes: true,
  salt: 'token-abc',
  publishedAt: '2026-07-13T12:00:00.000Z',
};

const trip = () =>
  workspace(
    [
      node('trip', { title: 'Asia round trip', project: true, description: 'The big one', childIds: ['legs', 'a1', 'secret', 'cancelled'] }),
      node('legs', { title: 'Japan leg', project: true, childIds: ['a2'] }),
      node('a1', { title: 'Book flights', status: 'NEXT', dueAt: '2027-06-01', description: 'via Doha?' }),
      node('a2', { title: 'Ryokan night', status: 'NEXT', dueAt: '2027-06-10', dueEndAt: '2027-06-11', dueTime: '15:00', dueEndTime: '11:00' }),
      node('secret', { title: 'Budget ceiling', tags: ['#shared-hide'], childIds: ['leak'] }),
      node('leak', { title: 'Absolutely not public' }),
      node('cancelled', { title: 'Skipped idea', status: 'CANCELLED' }),
    ],
  );

describe('shareContent — the sanitizer', () => {
  it('builds the envelope: title, note, items, sections, publishedAt, version', () => {
    const c = shareContent(trip(), 'trip', OPTS)!;
    expect(c.version).toBe(1);
    expect(c.title).toBe('Asia round trip');
    expect(c.note).toBe('The big one');
    expect(c.publishedAt).toBe('2026-07-13T12:00:00.000Z');
    expect(c.items.map((i) => i.title)).toEqual(['Book flights']);
    expect(c.sections.map((s) => s.title)).toEqual(['Japan leg']);
    expect(c.sections[0].items[0]).toMatchObject({
      title: 'Ryokan night',
      due: { start: '2027-06-10', end: '2027-06-11', startTime: '15:00', endTime: '11:00' },
    });
  });

  it('a private node takes its whole subtree with it — and a private root publishes nothing', () => {
    const c = shareContent(trip(), 'trip', OPTS)!;
    const json = JSON.stringify(c);
    expect(json).not.toContain('Budget ceiling');
    expect(json).not.toContain('Absolutely not public');
    // Case variants too (canonicalTag collapses system tags).
    const doc = trip();
    doc.nodes['secret'].tags = ['#Shared-Hide'];
    expect(JSON.stringify(shareContent(doc, 'trip', OPTS))).not.toContain('Budget ceiling');
    // Private root: nothing to publish.
    doc.nodes['trip'].tags = ['#shared-hide'];
    expect(shareContent(doc, 'trip', OPTS)).toBeNull();
  });

  it('cancelled and archived subtrees are always out; done stays (progress is a feature)', () => {
    const doc = trip();
    doc.nodes['a1'].status = 'DONE';
    doc.nodes['legs'].status = 'ARCHIVED';
    const c = shareContent(doc, 'trip', OPTS)!;
    expect(JSON.stringify(c)).not.toContain('Skipped idea');
    expect(JSON.stringify(c)).not.toContain('Japan leg'); // archived section gone, subtree included
    expect(c.items.map((i) => i.title)).toEqual(['Book flights']); // done, still visible…
    expect(c.items[0].done).toBeUndefined(); // …but statuses are off in these options
  });

  it('field toggles: statuses mark done; dropping notes/dates drops them everywhere', () => {
    const doc = trip();
    doc.nodes['a1'].status = 'DONE';
    const withStatus = shareContent(doc, 'trip', { ...OPTS, includeStatus: true })!;
    expect(withStatus.items[0].done).toBe(true);

    const bare = shareContent(doc, 'trip', { ...OPTS, includeDue: false, includeNotes: false })!;
    const json = JSON.stringify(bare);
    expect(json).not.toContain('due');
    expect(json).not.toContain('via Doha?');
    expect(json).not.toContain('The big one');
  });

  it('ALLOWLIST: no workspace node id, tag, resource, or unknown field ever leaks', () => {
    const doc = trip();
    doc.nodes['a1'].tags = ['economy', 'summer-trip-27'];
    doc.nodes['a1'].resources = [{ type: 'URI', value: 'https://secret.example/booking', description: 'Booking' }];
    doc.nodes['a1'].blockedBy = ['a2'];
    // A field the sanitizer has never heard of — must not survive the copy.
    (doc.nodes['a1'] as NamNode & { futureSecretField?: string }).futureSecretField = 'leak me';
    const json = JSON.stringify(shareContent(doc, 'trip', { ...OPTS, includeStatus: true }));
    for (const forbidden of ['"a1"', '"a2"', '"trip"', 'economy', 'summer-trip-27', 'secret.example', 'Booking', 'blockedBy', 'futureSecretField', 'childIds', 'status']) {
      expect(json).not.toContain(forbidden);
    }
  });

  it('delegated questions (#827): guestEditable QUESTIONs copied with text + answer', () => {
    const doc = trip();
    doc.nodes['a1'].resources = [
      { type: 'QUESTION', value: 'yes', description: 'Bringing a tent?', guestEditable: true },
      { type: 'QUESTION', value: '?', description: 'private q' }, // un-flagged: ABSENT
      { type: 'QUESTION', value: 'no', description: '', guestEditable: true }, // no text: ABSENT
    ];
    const c = shareContent(doc, 'trip', OPTS)!;
    expect(c.items[0].questions).toEqual([{ index: 0, question: 'Bringing a tent?', value: 'yes' }]);
    const json = JSON.stringify(c);
    expect(json).not.toContain('private q');
  });

  it('delegated counters (#809): guestEditable COUNTs are copied, everything else stays home', () => {
    const doc = trip();
    doc.nodes['a1'].resources = [
      { type: 'URI', value: 'https://secret.example', description: 'not shared' },
      { type: 'COUNT', value: '3/12', description: 'jars', guestEditable: true },
      { type: 'COUNT', value: '1/5', description: 'private count' }, // un-flagged: ABSENT
    ];
    doc.nodes['legs'].resources = [{ type: 'COUNT', value: '2/4+', description: null, guestEditable: true }];
    const c = shareContent(doc, 'trip', OPTS)!;
    // The index is the OWNER-side resource position — the event round-trip key.
    expect(c.items[0].counters).toEqual([{ index: 1, value: '3/12', label: 'jars' }]);
    expect(c.sections[0].counters).toEqual([{ index: 0, value: '2/4+' }]);
    const json = JSON.stringify(c);
    expect(json).not.toContain('private count');
    expect(json).not.toContain('1/5');
    expect(json).not.toContain('secret.example');
  });

  it('never leaks the drain idempotency ledger (#850): drainLedger stays owner-private', () => {
    const doc = trip();
    // A delegated counter whose node carries a ledger of already-applied guest-event ids.
    doc.nodes['a1'].resources = [{ type: 'COUNT', value: '3/12', description: 'jars', guestEditable: true }];
    doc.nodes['a1'].drainLedger = { 0: [90001, 90002, 90003] };
    const c = shareContent(doc, 'trip', OPTS)!;
    // The counter is copied, but the ledger — server-side bookkeeping — is not, anywhere.
    expect(c.items[0].counters).toEqual([{ index: 0, value: '3/12', label: 'jars' }]);
    const json = JSON.stringify(c);
    expect(json).not.toContain('drainLedger');
    expect(json).not.toContain('90001');
  });

  it('the envelope remembers HOW it was published (#823/P2)', () => {
    const c = shareContent(trip(), 'trip', { ...OPTS, includeDone: false })!;
    expect(c.options).toEqual({ includeDue: true, includeStatus: false, includeNotes: true, includeDone: false });
    const d = shareContent(trip(), 'trip', OPTS)!; // absent includeDone reads as true
    expect(d.options?.includeDone).toBe(true);
  });

  it('hide completed (#817): DONE subtrees stay home when the share says so — default keeps them', () => {
    const doc = trip();
    doc.nodes['a1'].status = 'DONE';
    doc.nodes['legs'].status = 'DONE'; // a done SECTION takes its subtree with it
    // Default (absent includeDone): unchanged behavior, done items still published.
    const kept = shareContent(doc, 'trip', OPTS)!;
    expect(kept.items.map((i) => i.title)).toEqual(['Book flights']);
    expect(kept.sections.map((sec) => sec.title)).toEqual(['Japan leg']);
    // Hidden: both gone, and the derived root span no longer sees their dates.
    const hidden = shareContent(doc, 'trip', { ...OPTS, includeDone: false })!;
    expect(hidden.items).toEqual([]);
    expect(hidden.sections).toEqual([]);
    expect(hidden.due).toBeUndefined(); // a1 + a2 carried all the dates
    // A fully-done root publishes nothing under the toggle.
    doc.nodes['trip'].status = 'DONE';
    expect(shareContent(doc, 'trip', { ...OPTS, includeDone: false })).toBeNull();
  });

  it('#shared-show (#838): forces a DONE item past Hide-completed, but never past a hard hide', () => {
    const doc = trip();
    doc.nodes['a1'].status = 'DONE';
    doc.nodes['a1'].tags = ['#shared-show']; // pin this done item visible
    // A2 lives under a done section we also hide, but tagged #shared-show — must NOT resurrect
    // (its ancestor is hard/soft-hidden and buildChildren never recurses in).
    doc.nodes['legs'].status = 'DONE';
    doc.nodes['a2'].tags = ['#shared-show'];
    const shown = shareContent(doc, 'trip', { ...OPTS, includeDone: false })!;
    expect(shown.items.map((i) => i.title)).toEqual(['Book flights']); // forced-in survives
    expect(shown.sections).toEqual([]); // the done section stays hidden; a2 doesn't escape it

    // #shared-show never beats a HARD exclusion: a #shared-hide + #shared-show node stays gone.
    const doc2 = trip();
    doc2.nodes['a1'].tags = ['#shared-hide', '#shared-show'];
    const c = shareContent(doc2, 'trip', OPTS)!;
    expect(c.items.map((i) => i.title)).toEqual([]); // hide wins
  });

  it('#shared-open (#838): a section carries open=true for the guest renderer', () => {
    const doc = trip();
    doc.nodes['legs'].tags = ['#shared-open'];
    const c = shareContent(doc, 'trip', OPTS)!;
    expect(c.sections[0].open).toBe(true);
    // Untagged sections leave the flag absent (minimal JSON).
    const plain = shareContent(trip(), 'trip', OPTS)!;
    expect(plain.sections[0].open).toBeUndefined();
  });

  it('pseudonymous ids: stable for the same salt, different across salts, never the node id', () => {
    const a = shareContent(trip(), 'trip', OPTS)!;
    const b = shareContent(trip(), 'trip', OPTS)!;
    const c = shareContent(trip(), 'trip', { ...OPTS, salt: 'other-token' })!;
    expect(a.items[0].id).toBe(b.items[0].id); // stable across republishes
    expect(a.items[0].id).not.toBe(c.items[0].id); // rotation re-minted
    expect(a.items[0].id).not.toBe('a1');
    expect(a.items[0].id).toMatch(/^[0-9a-f]{8}$/);
  });

  it('a deriving project section carries its effective span (#706 on the guest page)', () => {
    const doc = trip();
    doc.nodes['legs'].deriveDue = true; // derives from Ryokan night
    const c = shareContent(doc, 'trip', OPTS)!;
    expect(c.sections[0].due).toMatchObject({ start: '2027-06-10', end: '2027-06-11' });
  });

  it("a derived span never carries a private child's dates — min/max of one item IS that item (#772/F1)", () => {
    const doc = trip();
    // The section's ONLY dated child is private: the span must not exist at all.
    doc.nodes['legs'].deriveDue = true;
    doc.nodes['a2'].tags = ['#shared-hide'];
    const c = shareContent(doc, 'trip', OPTS)!;
    expect(c.sections[0].due).toBeUndefined();
    // And a private sibling must not stretch a span derived from public children.
    const doc2 = trip();
    doc2.nodes['legs'].deriveDue = true;
    doc2.nodes['legs'].childIds = ['a2', 'secretTrip'];
    doc2.nodes['secretTrip'] = { ...doc2.nodes['a2'], id: 'secretTrip', title: 'Divorce lawyer', tags: ['#shared-hide'], dueAt: '2027-09-01', dueEndAt: '2027-09-30' };
    const c2 = shareContent(doc2, 'trip', OPTS)!;
    expect(c2.sections[0].due).toMatchObject({ start: '2027-06-10', end: '2027-06-11' });
  });

  it('a corrupt cyclic document publishes what it can instead of blowing the stack (#772/F5)', () => {
    const doc = trip();
    doc.nodes['legs'].childIds = ['a2', 'trip']; // cycle back to the root
    const c = shareContent(doc, 'trip', OPTS)!;
    expect(c.sections[0].items.map((i) => i.title)).toEqual(['Ryokan night']);
  });

  it('non-project or missing roots return null', () => {
    expect(shareContent(trip(), 'a1', OPTS)).toBeNull();
    expect(shareContent(trip(), 'ghost', OPTS)).toBeNull();
  });
});
