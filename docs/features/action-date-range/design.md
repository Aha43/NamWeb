# Action date range (time span) — design note

Issue: #438 · Epic: #439 (calendar-board) · NamDesktop mirror: Aha43/NamDesktop#425 · Status: **decided / ready to implement (not started)**

## Decision (resolved 2026-06-28, with NamDesktop)

- **Field:** flat **`dueEndAt: string | null`** (`YYYY-MM-DD`), sibling of `dueAt`. Range iff both set
  and `dueEndAt >= dueAt`; `dueAt` alone = today's single-date behaviour. (Flat chosen over a
  `{start,end}` object — mirrors desktop's existing flat `dueAt`/`LocalDate`.)
- **Round-trip is already safe — no desktop change needed to ship.** NamDesktop's
  `JsonWorkspaceRepository` disables `FAIL_ON_UNKNOWN_PROPERTIES` and captures/re-emits unknown
  fields at every level (`NamNode.unknownFields` via `@JsonAnySetter/@JsonAnyGetter`); covered by
  `JsonWorkspaceRepositoryTest.unknownFields_surviveLoadSaveRoundTrip` (added for desktop #416), and
  the same repository is used on both Supabase push and pull. So a NamWeb-set `dueEndAt` survives a
  desktop read+rewrite untouched.
- **Sort/grouping stay keyed on the start (`dueAt`)** → #437 unchanged; desktop `DueLens` unaffected
  (a ranged action buckets by its start, exactly as today).
- **Parity:** web leads. NamWeb ships; desktop view/edit mirror tracked in **NamDesktop #425**
  (labeled `nam-web`). The "should a range spanning today also surface in Today/This Week" question is
  a future desktop product decision — not part of this contract.

**→ NamWeb is unblocked to build #438** (pending the user's go + the minor sprint items).

## Context / motivation

Today an action has a single `dueAt` (one ISO local date). For the **calendar-board workflow**
(months as sub-projects, viewed in Column view — #439) some cards represent things that **span
several days** — "trip 12–16th", "conference week", "renovation 3rd–10th". A single date can't
express that. We want an optional **end date** so an action can carry a **range**, and when sorting
by due (the #437 toggle) the **start** date is the sort key.

Keep it small and additive: actions with only `dueAt` must behave exactly as today.

## Current model (what exists)

- `NamNode.dueAt: string | null` — ISO **local date** `YYYY-MM-DD` (`src/domain/types.ts`).
- Parse/format: `parseFlexibleDate` (`src/lib/dates.ts`); the editor's **Due** field
  (`ActionDialog.tsx`) accepts loose input like `26-7-4`.
- `dueGroups` (`src/domain/lenses.ts`) buckets non-done actions overdue / today / thisWeek / later
  off `dueAt`.
- `#437` due sort: `useDueSort` (per-project localStorage toggle) orders the workbench's actions by
  `dueAt` (soonest first, undated last). `ActionRowData.dueAt` carries it to rows.

## Shared contract — ✅ resolved

The workspace is **one JSONB document shared with NamDesktop** ([[workspace-jsonb-blob-sync]]); no DB
migration, but a shared-contract change. **Confirmed safe (2026-06-28):** NamDesktop preserves
unknown fields on round-trip (`JsonWorkspaceRepository` + `NamNode.unknownFields`, tested, same path
for Supabase push/pull) — so `dueEndAt` set by NamWeb is not lost on a desktop read+rewrite. Field
shape agreed as flat `dueEndAt`. Desktop UI mirror is its own issue (NamDesktop #425); no blocking
dependency. See the Decision section above.

## Proposed model

Add an optional **end date** alongside the existing `dueAt` (which becomes the **start**):

```ts
// NamNode
dueAt: string | null;     // unchanged — the start / the sortable date
dueEndAt?: string | null; // NEW — optional end of the range (YYYY-MM-DD), inclusive
```

A range exists iff `dueEndAt` is set **and** `dueAt` is set and `dueEndAt >= dueAt`. `dueAt` alone =
today's single-date behaviour. `dueEndAt` without `dueAt` is invalid (ignore the end).

**Why this shape (vs a `{start,end}` object or renaming `dueAt`→`startAt`):**
- **Zero churn / maximal back-compat:** every existing `dueAt` reader/writer (sort, groups, rows,
  editor, NamDesktop) keeps working untouched; the end is purely additive and optional.
- The sort key is already `dueAt` (= start) — #437 needs **no change**.
- Renaming `dueAt`→`startAt` would be a breaking contract change for no real gain.

(Open to a `{start,end}` object if NamDesktop prefers it — but `dueEndAt` is the lowest-risk.)

## Semantics

- **Sorting (#437):** unchanged — sort on `dueAt` (the start). Ranges sort by when they begin.
- **Due grouping (`dueGroups`):** group by **start** (`dueAt`) as today. Decision for ranges that
  have *started but not ended* (start < today ≤ end): recommend treating them by **start** for now
  (so an in-progress range shows where it began) — simplest and matches "first date is the one we
  sort/bucket on". A nicer "ongoing/today if today ∈ [start,end]" rule is a possible follow-up; flag
  as open.
- **"Overdue":** keep keyed off start for v1 (consistent with grouping). Revisit if it feels wrong.
- **Validation:** `dueEndAt` ignored unless `>= dueAt`; editor prevents end < start.

## UI

- **Editor (`ActionDialog.tsx`):** the **Due** field gains an optional **"to" / end** field (second
  date input, same `parseFlexibleDate` loose parsing), shown next to Due. Empty end = single date.
- **Row display:** when a range is set, show it as `start – end` (compact; reuse the existing due
  badge styling). Single date unchanged. Touch the shared due-badge/`ActionRowData` mapping.
- **Focus / other surfaces:** wherever `dueAt` is displayed, show the range when present (audit:
  rows, Focus card, Due view). Keep it read-only outside the editor in v1.

## Back-compat & rollout

- Older / NamDesktop documents without `dueEndAt` → treated as no range (single date). No migration.
- NamWeb writes `dueEndAt` only when set; never writes it for single-date actions (keep the blob clean).
- **Gate on the NamDesktop round-trip confirmation** (see shared-contract note) before release.

## Open questions — resolved

1. **NamDesktop round-trip:** ✅ preserves unknown fields (tested). No coordination blocker.
2. **Field shape:** ✅ flat `dueEndAt`.
3. **Due-grouping for an in-progress range:** group by **start** in v1; an "ongoing/today" bucket is a
   future product decision (and a desktop-side one too) — out of scope here.
4. **Due view:** lists a range once, by start (v1).
5. **Inline edit outside the editor:** no — v1 is editor-only.

## Suggested phased plan (after sign-off — not started)

1. **Confirm the NamDesktop contract** (round-trip / co-implement). Resolve Q1+Q2.
2. **Model + lenses:** add `dueEndAt` to `NamNode`; range-aware display helper; keep sort/groups on start.
3. **Editor:** add the end-date field (validation end ≥ start).
4. **Display:** range badge on rows / Focus / Due.
5. Tests: model/validation, range display, sort unaffected, round-trip preserves the field.

## Verification (when built)

- Unit: range validity (end ≥ start), display formatting, `dueGroups`/sort still key on start.
- e2e (mocked-desktop): set a range in the editor → row shows `start – end`; due-sort orders by start.
- Manual (CF preview): a month column with multi-day cards reads correctly; phone unaffected.
- Round-trip check against NamDesktop once coordinated.
