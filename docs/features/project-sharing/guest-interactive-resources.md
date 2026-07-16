# Guest-interactive resources — design

> Status: **Brewing (2026-07-16).** Extends [project sharing](design.md) (the 2.0.0 epic,
> shipped dark through stage 4) with a second kind of guest input. Distilled from a planning
> chat right after the v1.8.0 cut. Lab posture applies: this doc fixes the *shape* (write
> path, doctrine, contract); surface details are expected to be reshaped by dogfooding.

## Why this exists

The sharing doctrine so far has one commandment: **guests capture, never edit.** The
suggestion box is deliberately a one-way mailbox — a guest offers an idea, the owner
clarifies it into the workspace. That covers *input about the project*. It does not cover a
different, humbler kind of participation that real undertakings are full of: **a piece of
state that is a guest's to maintain.** The partner who keeps the jar count. The person a
question is addressed to, answering it. "You're responsible for keeping count of X" is
delegation, not suggestion — and today the shared page has no way to express it.

The counter family (#799/#801) makes this concrete for the first time: counters are already
interactive for the owner, already render read-only on guest-ready surfaces, and their legal
moves are tiny (±1). Future interactive types widen the same door — a y/n **question**
resource is the obvious next citizen (asked on the page, answered by the guest it's for).

## Why resources are the right carve-out (and not a doctrine break)

The resource family invariant does the heavy lifting: **value is for machines, description
is for humans.** An interactive resource's value is a small, structured, validatable thing
(`"14/12+"`), and each type's registry entry defines its legal moves — a counter accepts
±1, a question accepts yes/no. Letting a guest exercise *those moves* is nothing like
letting them edit titles, statuses, or structure:

- The guest never gets a free-text path into the workspace (that stays the suggestion box's
  job, with its clarify-on-arrival protection).
- The guest uses the *same constrained controls* the owner has — the pill IS the API.
- The owner delegates **a specific resource**, not a capability class. The unit of trust is
  "this jar count", not "counters".

Framed this way the commandment survives intact: guests still never edit the project — they
contribute to resources the owner explicitly handed them. **The resource is the contract
surface.**

## The trap this design must avoid

The guest page renders a **snapshot** (`project_shares.content`). If guest ticks wrote to
the snapshot: the next republish clobbers their counts, and guest state vs workspace state
become two diverging truths with no reconciliation story. Any design where the snapshot is
writable is wrong. The snapshot stays what it is — a one-way, owner-written publication.

## The model in one paragraph

Guests append **events, never state**: a new security-definer RPC in the suggestion-box
mold accepts `(token, node, index, delta)` and appends to a `share_resource_events` table
hanging off the stable `share_id` — quiet-false, capped, zero table grants. **The owner's
client drains the queue** into the workspace as ordinary `incrementCountResource` intents,
so the single-writer model survives untouched: guests never write the JSONB document — the
owner does, as always; guests feed a queue the owner consumes. The guest page renders
**snapshot + undrained events**, so a guest sees their own ticks immediately and is never
confused by a stale published count. Delegation is opt-in **per resource**: an additive
`guestEditable` flag on the resource itself, set in the ResourceDialog, absent-means-off.

## The write path, step by step

1. **Owner marks a resource guest-editable** (checkbox in the ResourceDialog, only offered
   for interactive types). The flag is an additive resource field — contract-safe, and a
   future desktop simply ignores it.
2. **Publish carries the flag** through the sanitizer into the snapshot (the sanitizer stays
   a pure allowlist; this is one more allowed key on resources it already copies).
3. **Guest ticks** — the guest page renders a live pill (CountPill's read-only mode grows an
   event-dispatching mode) that calls `add_share_resource_event(token, node, index, delta)`.
   The RPC validates: share enabled, event well-formed, caps not exceeded — same quiet
   `false` for every refusal (no oracle).
4. **Guest sees the effect immediately**: the page fetches undrained events alongside the
   share and overlays them on the snapshot value (`snapshot current + Σ deltas`). Two guests
   interleave deltas without lost updates — appends don't race.
5. **Owner drains**: on app open (and on the sharing surfaces), the client fetches undrained
   events, maps pseudonymous node ids back to real ids (the owner holds the token — the
   salt — so the FNV mapping is recomputable), applies each as a normal
   `incrementCountResource` intent, and marks the events drained. Replay-safe: events have
   ids; draining is idempotent per event id.
6. **Provenance, not permission**: the share dialog (and perhaps the resource row) shows
   "N ticks from guests" — the owner *sees* guest activity but is not asked to approve each
   event. Ticking the `guestEditable` box **was** the adoption — pre-approval of the whole
   class of legal moves for that resource.

## Auto-apply vs adopt — the doctrine ruling

The suggestion box made the owner the clarifier on purpose: free text needs clarifying.
Interactive-resource events do not — they are pre-constrained by the type's registry entry
and pre-approved by the per-resource flag. An adopt-per-tick tray would kill the actual use
case ("she keeps the count" only works if her tick IS the count). So: **auto-drain for
counters.** The tray shows provenance, never asks permission.

This is a *per-type* ruling, carried by the registry. A future QUESTION type may sit
differently (an answer feels more adopt-shaped — it may deserve a "guest answered: yes,
apply?" moment). The registry entry grows a `guestPolicy` when the second interactive type
arrives; counters hard-code auto-drain until then. Don't design the general mechanism
before the second case exists — lab it.

## Schema (draft)

```sql
create table public.share_resource_events (
  id          bigint generated always as identity primary key,
  share_id    uuid not null references public.project_shares (share_id) on delete cascade,
  node_id     text not null,          -- pseudonymous (guest-page id space)
  res_index   int  not null,
  delta       int  not null check (delta in (-1, 1)),
  drained     boolean not null default false,
  created_at  timestamptz not null default now()
);
```

Lessons applied from birth (the stage-1/stage-4 corrections):

- Hangs off **stable `share_id`**, not the token (rotation-proof).
- **Zero anon grants + explicit revokes** on the table (hosted default-privileges
  auto-grant); the single guest write path is the RPC; the single guest *read* path (for the
  overlay) is a security-definer `get_share_resource_events(token)` returning undrained
  events for an enabled share only.
- **Caps count the OPEN queue** (drained rows don't ratchet — the #802/F1 lesson learned the
  same week it would have been repeated), plus a lifetime abuse backstop. Something like
  500 undrained / 50 undrained per resource; numbers are lab-tunable.
- The RPC validates `delta` against the type's legal moves **and nothing else** — it cannot
  see the snapshot's semantics (target, unlimited) and must not try; clamping/overshoot
  rules are applied where they already live, in the owner-side reducer at drain time. A
  guest can over-tick a limited counter's queue; the drain clamps exactly like the owner's
  own taps would. The guest-page overlay applies the same display clamp client-side.
- `node_id`/`res_index` are **untrusted hints** (the stage-4 forward flag): the drain
  resolves them against the *owner's* recomputed mapping and current document — unknown ids,
  shifted indexes, or type mismatches drop the event (the same tolerated-no-op family as
  `incrementCountResource` itself).

## What this deliberately does not do

- **No realtime.** Drain-on-app-open latency is fine for jar counts; the guest's own view is
  live via the overlay. Realtime is a later lab iteration if dogfooding demands it.
- **No guest identity.** Events are anonymous, like suggestions. Per-guest attribution
  ("Anna ticked 3") would need guest naming — a separate discussion, not smuggled in here.
- **No generic guest editing.** The door opens per resource, per type, through the registry.
  Anything without a registry-defined legal-move set stays read-only forever.
- **No snapshot writes.** Republishing remains a pure owner action; it also does not reset
  the queue (events reference the resource, not the snapshot version — the drain reconciles).

## Open questions — with leans

1. **Drain triggers.** App open + share-dialog open, or also a periodic pull while the app
   is open? *Lean: app open + dialog open first; add a timer only if dogfooding shows counts
   arriving while the owner sits in the app.*
2. **Does the guest page show the flag?** A subtle "you can update this" affordance vs the
   pill just being live. *Lean: the live pill is its own affordance; no extra chrome.*
3. **Overlay vs republish freshness.** The overlaid count can outrun the snapshot's other
   content; after the owner drains + republishes, events are gone and the snapshot carries
   the truth. Any window where a guest sees the count "jump"? *Lean: acceptable — the jump
   is the publish, same as any content change; verify in the lab.*
4. **`guestEditable` in the dialog** — offered for COUNT only at first, or plumbed
   registry-wide with one consumer? *Lean: registry-wide field (`interactive` types only),
   COUNT the sole current member — that's one entry, not speculative machinery.*

## Staging (lab iterations, all Labs-dark)

1. **The flag + the pipe** — `guestEditable` on COUNT in the ResourceDialog, sanitizer
   carries it, migration + both RPCs, guest pill goes live with the overlay, owner drains on
   app/dialog open, provenance line in the share dialog. One iteration, end-to-end thin.
2. **Tend the ergonomics** — whatever dogfooding surfaces (caps, drain triggers, overlay
   feel, the provenance line's shape).
3. **The second interactive type** (QUESTION, y/n) — and with it the registry's
   `guestPolicy` (auto vs adopt) becomes real, designed against two cases instead of one.
