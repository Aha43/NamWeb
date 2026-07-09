# Derived project time — design note

Status: **agreed in planning chat (2026-07-09), ready for implementation** · Arc: projects×time
(step 3, after #699 due controls / #700 row hints / #703 projects on the calendar) ·
NamDesktop: one additive node field (heads-up, no handover negotiation — see *Contract*)

## Decision

A project can **derive its time span from its contents** — opt-in, per project:

- **New persisted field:** `deriveDue?: boolean` on `NamNode` (projects only in practice; absent =
  `false` = exactly today's behaviour). The **only** thing written; everything derived is computed.
- **Effective span — explicit wins per edge, derived fills the gaps.** With `deriveDue` on:
  - effective **start** = explicit `dueAt` if set, else the **earliest** date among the project's
    dated descendants
  - effective **end** = explicit `dueEndAt` if set, else the **latest** date among them
    (a descendant's own end date counts; a range descendant contributes both edges)

  The motivating case: a holiday project starts the day you leave the house (explicit start,
  typed) but ends whenever the last booked item ends (derived end, breathing as bookings land).
  Both edges explicit → derivation is moot even when on. Toggle off → today's behaviour, bit for
  bit.
- **Source set: the whole subtree, DONE included.** All dated descendants (actions and
  sub-projects, recursive), excluding CANCELLED and archived subtrees. Rationale: completing
  "book flights" early must not shrink the holiday — a done dated action still marks *when things
  happen*. (This deliberately differs from the calendar's "open" filter, which is about work
  remaining; derived span is about when the project *occurs*.)
- **Derived edges look derived — subtly.** Wherever the effective span renders (row hints, the
  calendar's project badges/tooltip/drill-in, the Details panel), a derived edge gets a quiet
  distinction: italic in the due hint plus a "derived from contents" tooltip. In the Details
  panel's due inputs, derived values appear as **ghost placeholders** you can type over (typing
  makes that edge explicit; clearing it falls back to derived).
- **Natural recursion (resolved 2026-07-09).** A deriving **sub-project** contributes its
  **effective** span upward — derived edges included — so nesting composes: the holiday derives
  from the road-trip leg, which derives from its stops. A sub-project with `deriveDue` off
  contributes only its explicit dates, exactly like an action. (Implementation note: compute
  bottom-up / memoize per node; the tree is acyclic, so nothing beyond that is needed.)
- **Vocabulary:** UI copy says **"derive from contents"** (or similar) — *not* "rub off", which in
  NAM already means tags flowing **down** from ancestors. This flows **up** from contents.

## What this touches

- `src/domain/types.ts` — `deriveDue?: boolean` (additive; JSDoc marks the shared-contract
  treatment like `dueEndAt`/`dueTime`, #438/#493/#500).
- `src/domain/mutations.ts` — carry `deriveDue` on the due-editing intent (or a tiny dedicated
  intent), so the Details panel toggle persists it.
- **New lens** (likely `src/domain/derivedDue.ts` or beside the calendar lenses):
  `effectiveDue(doc, node) → { dueAt, dueEndAt, dueTime, dueEndTime, derivedStart: boolean,
  derivedEnd: boolean }`. Times ride only on explicit edges (deriving times from children is out
  of scope — a derived edge is date-only).
- Consumers switch from raw fields to the effective span for **projects**:
  - `DueHintLabel` (#700) — gains the italic/derived treatment,
  - calendar read model (#703) — `openDatedProjects` considers a deriving project "dated" when
    its effective span exists,
  - `ProjectDetailsPanel` / `DueFieldset` (#699) — the toggle lives in the due block; ghost
    placeholders for derived edges.
- Actions are untouched — `deriveDue` is meaningless on non-projects and ignored.

## Contract (NamDesktop)

Additive optional field on the shared JSONB workspace document — the same story as `dueEndAt`
(#438): NamDesktop's repository round-trips unknown fields (verified then), so a web-set
`deriveDue` survives desktop read+rewrite untouched. Web leads; a desktop mirror of the toggle
and derivation is a future desktop decision. Derived values themselves are **never persisted**,
so there is nothing else to agree on.

## Deliberately out of scope

- Deriving **times of day** (derived edges are date-only).
- Projects in the **Due view** (still excluded by `dueGroups`' project guard — separate decision).
- Any automatic enabling — `deriveDue` defaults off for every project, existing and new.
- Desktop UI for the toggle.

## Open questions (small, decide during implementation)

- Ghost-placeholder ergonomics in `DueFieldset` (placeholder text vs a prefilled-but-dimmed
  value) — pick whatever reads best in the existing component.
