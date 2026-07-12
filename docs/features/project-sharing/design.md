# Project sharing — design

> Status: **Draft for review (2026-07-12).** The 2.0.0 epic. Distilled from two planning
> sessions (the idea emerged from an expedition-planner brainstorm that converged on
> "NAM + projects as web pages"); becomes "ready for implementation" when the open questions
> below are settled and the staging is agreed.

## Why this exists

NAM is a single-player system, and that is a feature — but real undertakings have
participants. The motivating scenario: **planning a big family/friends trip a year out**
(Asia round trip; Japan or Canada as alternatives). The owner plans and executes in NAM as
usual — but shaping the expedition needs *input from others over months*, and those others
will never be NAM users. Asking a sister to "sign up, sync a workspace" is friction that
kills the whole idea; she doesn't know or care about the nerdy NAM bit, and shouldn't have to.

The core move: **guests are never users.** A project can be *published* to a secret URL that
renders it as a friendly, readable web site. Anyone with the link sees exactly what the owner
enabled — no account, no app chrome, no concept of NAM at all. This deliberately dodges the
multi-user-workspace epic (auth, permissions, presence, merge semantics) — possibly forever —
while capturing most of the collaboration value.

This is **large-scale dogfooding by design**: the real trip is the acceptance test, with a
year of runway. It also displaces MCP as the 2.0.0 milestone (MCP returns after — the
chat→"make it in NAM"→execute flow proved in the NamDesktop lab).

## The model in one paragraph

Publishing a project creates a **share**: a row keyed by a high-entropy secret **token**,
holding a **sanitized snapshot** of the project (only the enabled nodes and fields), written
by the owner's client. The guest page (`/p/<token>`) is a public route in the same SPA that
fetches the share by token (anonymous, RLS-scoped to exactly that row) and renders it as an
itinerary-like site. Guests contribute through a **suggestion box** that writes to a
suggestions table — arriving on the owner's side as capture items to clarify, never as edits.
The link *is* the access (capability URL); revocation = deleting the row; rotation = new
token. Nothing about the owner's workspace document becomes publicly readable — the
guest-visible data is **physically separate**, so an over-sharing bug would have to be a
*copying* bug, not a *filtering* bug in a hot path.

## Scope

### In (the epic, staged — see Staging)
- **Publish / republish / unpublish / rotate** a share per project, from the workbench.
- **Snapshot architecture**: client-side sanitizer → `project_shares` row. No server code.
- **Visibility grammar**: opt-in per project (publishing is the act); opt-out per node via a
  `private` **system tag** (the #651 mechanism); per-share **field toggles** (due dates,
  statuses, notes).
- **The guest page**: `/p/<token>` — un-NAM, mobile-first, no chrome, no sign-in, `noindex`;
  graceful "this link is no longer active" state.
- **Freshness**: manual republish with a "changes since last publish" hint first;
  auto-republish-on-save as a follow-up once trusted.
- **Guest input**: a suggestion box (name + text) → `share_suggestions` → an owner-side
  "From guests" tray feeding the existing inbox/process wizard, provenance kept
  ("Anna suggested: ryokan night in Hakone").

### Out (later / explicitly not now)
- **Multi-user workspaces, guest accounts, per-guest identity/permissions.** The point of the
  design is not needing them.
- **Guest editing** of any kind. Guests capture; the owner clarifies. (Votes/reactions are a
  possible later stage on the same suggestion rails.)
- **Live projection** (edge-function-rendered, always-current shares) — superseded by
  snapshot + auto-republish unless dogfooding proves staleness painful (see Alternatives).
- **Sharing anything but a project subtree** (no whole-workspace shares, no tag-filter shares).
- **Custom domains, theming, guest-page comments threads.**

## How it fits the architecture

- The workspace stays **one JSONB document readable only by its owner**. Shares live in new,
  separate tables; the anonymous role can read exactly one share row (by token) and insert
  suggestions — never touch `workspaces`.
- **First NamWeb-driven schema** — enabled by Sprint 0 (migrations live in `supabase/` here).
- **Trunk-based, dark**: every sharing PR merges to `main` through the normal
  issue→PR→review→cut machinery. The feature is unreachable until a share exists; the Share
  UI hides behind a settings toggle (Labs) until the 2.0.0 cut unveils it. 2.0.0 is a *cut*,
  not a branch.
- The share's `content` carries its own **format version** — the guest renderer's contract is
  with the snapshot, not the workspace document format.

## Schema (draft)

```sql
create table project_shares (
  token         text primary key,          -- high-entropy secret (crypto-random, ~128 bits)
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  project_id    text not null,             -- node id inside the owner's document
  content       jsonb not null,            -- the sanitized snapshot (versioned envelope)
  enabled       boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- RLS: owner full CRUD on own rows; anon/authenticated SELECT of a single row by token
-- (no listing), and only where enabled.

create table share_suggestions (
  id            bigint generated always as identity primary key,
  token         text not null references project_shares (token) on delete cascade,
  guest_name    text,                      -- free text, optional ("Anna")
  body          text not null check (char_length(body) <= 2000),
  node_id       text,                      -- optional: which item the suggestion is about
  created_at    timestamptz not null default now(),
  handled       boolean not null default false
);
-- RLS: anon INSERT where the token's share is enabled; owner SELECT/UPDATE/DELETE on
-- suggestions whose share they own. Anon can never read suggestions (guests don't see each
-- other's input in v1 — a deliberate social simplification).
```

Open hardening questions live in *Open questions* (rate limiting, size caps, token format).

## The sanitizer (the security boundary)

A **pure domain function**: `shareContent(doc, projectId, options) → ShareContent`.

- Walks the project subtree only; **copies** enabled data into a fresh structure (allowlist,
  not blocklist — fields are *included* by name, so new document fields default to private).
- Excludes any node carrying the `private` system tag (subtree-inclusive: a private node's
  children are gone too).
- Honors `options`: include due dates / statuses / notes (per-share toggles).
- Strips everything structural/nerdy: ids are re-minted (guest-side ids must not leak
  workspace node ids — see Open questions), tags are dropped (except possibly a curated
  "label" story later), resources included only when explicitly enabled (URLs may be private).
- Output envelope: `{ version: 1, title, publishedAt, sections: [...] }` — the guest
  renderer's whole world.

This function gets the heaviest unit suite of the epic and is the review dance's standing
target. It runs at *publish time* on the owner's device — never in a request path.

## The guest page

- `/p/<token>` in the same SPA, outside the auth gate (like `/demo`): fetch share → render.
- **Un-NAM on purpose**: no sidebar, no command bar, no sign-in prompt. A clean, readable,
  mobile-first page — the project title as the masthead, sub-projects as sections, actions as
  list items with (optional) dates rendered friendly, notes as prose. "Spa-ish."
- States: loading; not-found/revoked ("this link is no longer active" — identical for both,
  no oracle for token guessing); suggestion-box success/thanks.
- `noindex` meta + `X-Robots-Tag` where possible; the URL's secrecy is the access control and
  search engines must never learn it.
- A quiet footer credit ("shared from NAM") — the only NAM presence, and the funnel.

## Owner-side UX

- A **Share** section on the project workbench (behind the Labs toggle until 2.0.0):
  - *Publish* → creates the share, shows the URL + copy button (the #732 tooltip/copy
    conventions apply).
  - The **field toggles** (dates/statuses/notes) — the summary dialog's include-filters are
    the design precedent.
  - *Republish* with a "changes since last publish" hint (dirty = document `updatedAt` newer
    than share `updated_at` for the subtree — approximation acceptable).
  - *Unpublish* (revoke) and *Rotate link* (new token, old dies) — both need confirms.
- The `private` tag is applied with the normal tag tools; the Share section shows a count
  ("3 items marked private") so exclusions are visible at publish time.
- **From guests** tray: suggestions listed with name/time/context; per-suggestion "to inbox"
  (creates a capture item with provenance in the note) and dismiss.

## Staging (sprints, all dark until the cut)

1. **Schema + sanitizer + publish/unpublish** — migration, `shareContent` + its suite, the
   Share section (Labs-gated), URL + copy. *Dogfoodable: publish the real trip project.*
2. **The guest page** — `/p/<token>` end to end. *Dogfoodable: send the link to one sister.*
3. **Freshness + visibility polish** — dirty hint, republish ergonomics, field toggles if not
   in (1), the `private`-tag counter.
4. **The suggestion box** — guest form → suggestions table → From-guests tray → inbox.
5. **2.0.0 cut** — Share leaves Labs; the unveiling release.

Auto-republish-on-save, votes/reactions, per-node suggestion anchors: post-2.0.0 candidates,
driven by trip dogfooding.

## Alternatives considered

- **A separate expedition-planner app** — rejected: rebuilds NAM minus its maturity; the guest
  page *is* the planner, as a projection.
- **Guests as (anonymous) Supabase users** — rejected: accounts by another name; RLS
  complexity; the sister test fails.
- **Live projection via edge function** — deferred: always-fresh, but introduces NamWeb's
  first server-side hot path and puts the sanitizer in it (a filtering bug leaks live data).
  Snapshot + auto-republish approximates it with strictly better failure modes.
- **Share metadata inside the workspace document** — rejected for v1: shares are
  infrastructure, not domain; a table keeps the document format clean (and the future desktop
  redo unburdened). Revisit only if "is this project shared?" needs to be visible offline.
- **Long-lived 2.0 branch** — rejected (2026-07-12 discussion): trunk-based dark rollout
  through the normal review/cut machinery; 2.0.0 is a cut, not a codebase.

## Open questions (to settle before/while cutting issues)

1. **Token format & entropy** — proposal: 22+ chars base62 from `crypto.getRandomValues`
   (~128 bits). Also: URL shape `/p/<token>` vs `/s/<token>`; token in path vs fragment.
2. **Guest-side node identity** — re-minted ids per publish (simplest, breaks per-node
   suggestion anchors across republishes) vs stable pseudonymous ids (a per-share salt +
   hash of node id). Needed by stage 4's `node_id`; lean: stable pseudonymous.
3. **Anon abuse control** — Supabase anon inserts: what's enough for v1? Size caps + a
   per-share suggestion cap (e.g. 500) + captcha only if the trip proves spammy? Turnstile
   integration exists for sign-up already.
4. **Field-toggle defaults** — dates on, statuses off, notes on? Decide from the trip
   project's shape.
5. **`private` polarity confirmation** — opt-out within a published project is the lean;
   is a `shared`-only-opt-in mode ever needed (paranoid mode)?
6. **Realtime on the guest page** — none in v1 (refresh is fine for monthly-cadence
   planning); revisit with auto-republish.
7. **Republish dirty-detection fidelity** — subtree `updatedAt` scan vs hash of the sanitized
   output (hash is exact and cheap at publish scale; lean: hash).
8. **The Labs toggle mechanics** — settings-panel switch (device-level) is the lean.
9. **i18n of the guest page** — owner's locale? guest browser locale? (Both en/nb exist.)
   Lean: guest browser locale, it's their page.
10. **Suggestion → inbox mechanics** — a capture item whose note carries provenance, or a
    dedicated resource type? Lean: plain note provenance, no contract change.
