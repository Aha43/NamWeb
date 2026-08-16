# SOMEDAY status — design

Status: **ready for implementation** (#1131). Promotes the dogfooding spec (written by an MCP-Claude
while chatting about GTD practice) into a build handoff, adding the domain/architecture decisions.

## Purpose

Add a **SOMEDAY** status alongside `NEXT` / `BACKLOG` / `DONE`. The distinction is **commitment, not
timing**:

- **BACKLOG** — *I think this should be done*, just sequenced behind stronger candidates. Soft
  ordering, not a hard dependency (`blocked_by` covers real dependencies).
- **SOMEDAY** — *I do not want to forget this, but I have not decided to do it.* It may never happen.

Triage test: **"have I decided to do this?"** — not *"is this soon?"*. Sort on **commitment**, not
urgency, or the two statuses collapse back into one within a month.

**Naming:** `SOMEDAY` (the canonical GTD term — instantly recognised) rather than `MAYBE`. Recover
MAYBE's honesty in the label hint under the control: **"not decided to do."**

## Scope — projects AND actions

Not action-only. Most of the value is at **project** level (real examples from the owner's tree:
*Astrogeist 2*, *Demens help*, *Social word game web*, *Ting å streame*, *"Someday NAM on ChatGPT
Apps"* — all projects). **A SOMEDAY project must never be asked for a next action**, and must not
count as a loose end.

## Behaviour

A SOMEDAY node — **and its entire subtree** — drops out of the day-to-day surfaces:

| Surface | SOMEDAY behaviour |
| --- | --- |
| `nextActions` / default Next views | excluded (self + descendants) |
| `backlogItems` / default Backlog views | excluded — *the whole point*: if someday items still show in backlog, backlog isn't clean |
| `stalledProjects` (Loose ends) | excluded — a someday project has no committed next action **by definition**; flagging it is exactly the noise this removes (~⅓ of the current ~38 stalled) |
| `goneQuiet` (Loose ends) | excluded — a someday item untouched 14+ days is normal, not a signal |
| context / tag filter views | excluded (they're "what to work") |
| **Someday view** + `list_someday` + **search** | **reachable here** — the only places it shows |

## Architecture — one generic suppression resolver

The inheritance ("rub-off") requirement — *if a project is SOMEDAY, its descendants also drop out* —
is the **same shape** as the existing archived-subtree logic (`lenses.ts` `archivedProjectIds` /
`archivedSubtreeIds`: a node whose own or ancestor status is `ARCHIVED` is excluded everywhere). We
generalise that walk once instead of open-coding a second traversal:

```
// lenses.ts — generalised from the existing archived walk
subtreeIdsWhere(doc, predicate): Set<string>   // every node under (and incl.) any node matching predicate
somedaySuppressedIds(doc) = subtreeIdsWhere(doc, n => n.status === 'SOMEDAY')
archivedSubtreeIds(doc)   = subtreeIdsWhere(doc, n => n.status === 'ARCHIVED')   // refactor onto it
```

**Two derivations, not one — the review's first catch.** The *exclusion* set and the *display* set
are different shapes, and reusing the archived walk naively would give the wrong one for the view:

- **`somedaySuppressedIds(doc)`** — **all** ids under any SOMEDAY node. Used only to **exclude** from
  the day-to-day lenses (like `archived`).
- **`somedayRoots(doc)`** — the **outermost** SOMEDAY nodes: `status === 'SOMEDAY'` **and not already
  inside another SOMEDAY (or archived) subtree**. This is what the **Someday view** and **`list_someday`**
  return. Mark `Ting å streame` someday → **one** row, not its nine descendants.

Every affected lens excludes `somedaySuppressedIds(doc)` (same way they already exclude `archived`);
the Someday surfaces render `somedayRoots(doc)`.

### SOMEDAY × ARCHIVED (the review's second catch)

Sharing one walk makes the interaction easy to get wrong (a Someday view showing archived nodes, or a
node appearing in both). Rule: **ARCHIVED wins** — it's the stronger "gone" state.

- Day-to-day exclusion = **union** of `somedaySuppressedIds` and `archivedSubtreeIds`.
- `somedayRoots` **excludes anything inside an archived subtree** — a someday node under an archived
  parent is archived-gone, not a someday to review; and an archived node under a someday parent shows
  in neither the Someday view (it's archived) nor the day-to-day lenses (suppressed by both).

**Relationship to `#not-stalled` (#909).** The spec says "solve the rub-off once." They share the
*self-or-ancestor walk*, but their **scope differs** and we keep them distinct:
- `SOMEDAY` = a **status** → suppress **self + descendants** from **all** day-to-day surfaces.
- `#not-stalled` = a **tag** → "don't flag as stalled," **project-level, stalled-only** (the node still
  shows in Next/Backlog).

So both call `subtreeIdsWhere` / the shared walk, but `#not-stalled` keeps its narrower application.
We **must not** widen `#not-stalled` to whole-subtree suppression — and the reason is stronger than
"unrequested." It would be a **category error**, not just a scope change:

- **SOMEDAY is a claim about the whole subtree** — *"I haven't decided to do any of this."* Inheritance
  is correct.
- **`#not-stalled` is a claim about one node** — *"don't ask **this** node for a next action"* (it's an
  area/container, not itself a project). An area is **not** committing its children to anything.
  Inheriting it would silence a claim the node never made.

The data confirms the harm: the `#not-stalled` carriers sit near the **top** of the tree — `Work`,
`NAM development` (the whole NamWeb/Product/Desktop/NamAdmin subtree), `Beredskap`, `Anskaffelser`,
`Next ScaleAq`. Subtree-wide inheritance would silence stall detection across **most of the active
workspace** — hiding genuine loose ends like `Promotion` (7 children, no NEXT), `Local test env`, and
`Notification` — exactly where the report is most useful. The **non-goal** below states why they stay
separate features.

> **Known limitation, out of scope for #1131:** `#not-stalled` can mask a *genuine* stall on the node
> it's applied to — e.g. `KosDåk Julebord` carries the tag, has two BACKLOG children, no NEXT, and is
> **due 11 Dec**. SOMEDAY doesn't touch it (correctly — it's not "someday"), and the tag is silencing a
> real stall. The cleaner stalled report must **not** be read as having handled that case; it's a
> separate future concern (the tag arguably shouldn't override a *dated* item).

## Transitions

- `BACKLOG ↔ SOMEDAY` — both directions, cheap. **Promotion out of someday is the normal happy path.**
- `SOMEDAY → NEXT` — allowed directly (deciding to do it and doing it next are often one moment).
- **Deleting from someday is a SUCCESS**, not a failure — a someday list is only safe to *add* to if
  it's safe to *empty*. Deletion must be **low-friction** in the Someday view (a per-row delete, no
  heavy confirm beyond the standard).

## MCP surface

- `mark_someday(node_id)` — mirrors `mark_next` / `mark_backlog`.
- `list_someday()` — the someday items (top-level someday nodes; a someday under a someday is
  redundant, list the outermost).
- `SOMEDAY` added to the status enum everywhere status is settable — the `add_action` /
  `add_next_action` / create tools' `NODE_STATUSES`, and it's a valid `set`/status target.

## UI surface

- **Status control**: `SOMEDAY` added to `STATUS_OPTIONS` (`status.ts`) with the label hint
  *"not decided to do"* (a muted tone — it's a parking state, not active work; distinct from DONE's
  terminal green). Available in the action editor, the workbench Details status radios, and the row
  status menu.
- **Someday view**: a route/nav surface listing someday projects + actions (the only in-app place they
  appear), with **low-friction delete** per row and quick promote (→ Next / → Backlog).
- Someday items stay out of the Next/Backlog/Loose-ends/context surfaces (via the resolver).

## Data / contract

- `NodeStatus` gains `SOMEDAY` (`'NEXT' | 'BACKLOG' | 'DONE' | 'CANCELLED' | 'ARCHIVED' | 'SOMEDAY'`).
- **Workspace-doc contract change** — a new status value. NamDesktop is parked, but per the additive
  discipline this is **spec-relevant for the future desktop redo**: a revival's Java `NodeStatus`/enum
  would throw on deserialize, so **extend the enum first** (same rigidity that forced `#`-tags and the
  `COUNT`/`QUESTION` resource types). Recorded here; not a blocker now.
- **Deferred (schema-aware, do NOT build now):** a `lastReviewedAt` on someday items — *not* a due
  date, just "you've looked at this N times without deciding," the signal to delete rather than carry.
  Noted so the schema doesn't make it awkward to add later.

## Relationships to open issues

- **Supersedes #1072** ("node intent / commitment level + marker node type so an AI review lens doesn't
  nag") — SOMEDAY is the concrete commitment-level answer. **Close #1072 on ship.**
- **Serves #1079** (stalled detection's anti-guilt) — SOMEDAY is the honest "I haven't committed"
  escape valve; excluding it prunes a large chunk of the false-positive stalled list.
- Related: #1091 (`lastActivityAt` rollup) and #1080 (`statusChangedAt`) — the review-lens correctness
  cluster; SOMEDAY reduces the pressure on stalled-grace tuning by removing the uncommitted items
  entirely.

## Non-goal

**SOMEDAY does not replace `#not-stalled`.** All 18 current `#not-stalled` carriers were checked —
none are "someday." They're **areas/containers** (NAM development, Work, Beredskap, Anskaffelser,
Power, Desktop, Product, NamAdmin), **sprint docks** (Next sprint, Future sprints, Next ScaleAq), and
**recurring checklists** (Forberede lønn, Formue tracking, Tørrvarer & Hermetikk, Batteries). That's a
different problem — those want an **area/container node kind**, not a status — and stay a separate,
future concern.

## Implementation plan (one cohesive PR — deliberately not stacked)

1. **Domain** — `NodeStatus += SOMEDAY` (`types.ts`); `subtreeIdsWhere` + `somedaySuppressedIds`
   (all descendants, for exclusion) + `somedayRoots` (outermost, not inside a someday/archived subtree,
   for display) in `lenses.ts`, refactoring `archivedSubtreeIds` onto the shared walk; exclude the
   **union** of `somedaySuppressedIds` and `archived` from `nextActions`, `backlogItems`, context/tag
   lenses, and (`review.ts`) `stalledProjects` / `goneQuiet`.
2. **Status plumbing** — `STATUS_OPTIONS` + tone + i18n (`domain.status.someday`, the hint); the
   `setStatus` reducer already accepts any `NodeStatus`.
3. **MCP** — `mark_someday`, `list_someday`, add `SOMEDAY` to `NODE_STATUSES`.
4. **UI** — Someday view/route + nav entry; status-menu / editor / Details option; low-friction delete.
5. **Tests** — lens exclusion (self + descendants) across all surfaces; `somedayRoots` returns the
   **outermost** node only (one row for a subtree, and nothing inside an archived parent); the
   SOMEDAY×ARCHIVED precedence; transitions; MCP mark/list + create-with-someday; an e2e journey (mark
   a project someday → it and its child action leave Next / Backlog / Loose ends, the **project** (one
   row) appears in the Someday view, promote/delete from there).
6. **Docs/CHANGELOG** — this doc + a `## [Unreleased]` Added entry; close #1072 on merge.

## Verification

Marking a project SOMEDAY removes it **and its descendant actions** from Next, Backlog, Loose ends
(stalled + gone-quiet), and context views; both appear only in the Someday view / `list_someday` /
search; promoting back to Backlog/Next restores them; deleting from Someday is one low-friction click.
The `#not-stalled` behaviour is unchanged.
