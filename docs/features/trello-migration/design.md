# Trello migration — design

> Status: **Scope settled in discussion (2026-06-24); ready to implement (no code started yet).**
> Promotes a dogfooding idea: the author has run Trello for ~a decade and sees NAM replacing it — so the
> first useful Trello touchpoint is **one-way migration as onboarding**, not ongoing sync.

## Why this exists

A lot of people (the author included) have **half-dead Trello boards full of still-useful intent** —
shopping lists, trip plans, readiness checklists, work areas. The most compelling thing NAM can say to
them is not *"connect Trello"* but:

> **"Bring your board into NAM, and we'll turn it into a living action/project system."**

Trello-as-perpetual-sync would bend NAM into Trello's shape (flat lists of cards). Trello-as-**migration**
does the opposite: it *reinterprets* a board into NAM's native structure — projects, actions, readiness
hierarchy, statuses, tags, due dates — and then the board is NAM's, not Trello's. This doubles as a
strong onboarding path (an imported board beats an empty workspace) and aligns with the household /
family-readiness direction (families already keep boards and checklists).

So: **Trello migration first, Trello sync (probably) never, Trello export later** only if collaboration
ever needs it.

## Scope

### In (MVP)
- A **Trello board JSON import** — the user uploads or pastes a board's JSON; **no account, no API key,
  no backend, no CORS.** A bundled **sample board** ("try with an example") makes it demoable and is a
  ready onboarding tour.
- An **import wizard**: load JSON → **classify each list** → **preview + migration report** → apply.
- A pure **interpretation engine** (`planImport`) that turns a parsed board + the user's classification
  into a resolved `SeedNode[]` (plus tag registrations and a report), applied through the **existing
  `seedProject` intent** — synced, replay-safe, no new domain mutation for the insert itself.
- **Provenance**: each imported node records where it came from (board/list/card ids + url + importedAt)
  so we can later re-import, dedupe, open the original, and produce reports.
- **Mappings** (see table below): lists → project / status / inbox / tag / skip; cards → action or
  project (promoted when they carry checklist items); checklists → child actions (checked → DONE);
  labels → tags; due → `dueAt`; attachments → typed `resources` (URI); archived cards → skipped (noted).

### Out (later / explicitly not now)
- **Live "Connect Trello"** (OAuth-style token popup + board listing + fetch from `api.trello.com`).
  Deferred to a fast-follow — the `planImport` engine is identical, only the data *source* changes.
- **Ongoing sync / webhooks / a Trello Power-Up.** Rejected by intent (see *Why this exists*).
- **Export back to Trello.** Only if collaboration ever demands it.
- **Members, comments, card activity.** NAM has no multi-user/comments model; reported as skipped.
- **Re-import / dedupe UX.** The provenance is stored now; using it to dedupe is a fast-follow.

## How it fits the architecture

NAM already has the import primitive. The **domain layer is transport-free**, and **`seedProject`** is
the intent `buildDemo` uses to insert a fully-resolved `SeedNode[]` tree — with `status`, `tags`,
`dueAt`, `description`, `resources`, `children`, `project` — in one synced, replay-safe shot
(`src/domain/mutations.ts`, `SeedNode`).

So the whole feature is **one pure function + the existing apply path**:

```
Trello board JSON
  → parseTrelloBoard(json)            → typed model: { board, lists, cards, checklists, labels }
  → planImport(board, classification) → { seeds: SeedNode[], registerTags: string[], report }   ← the NAM brain
  → preview (report + tree)
  → apply: dispatch seedProject (+ registerTag intents)                                          ← reuse, synced
```

- **`parseTrelloBoard`** — pure, defensive parse of the Trello JSON shape into our own typed model
  (tolerate missing fields, ignore unknown ones). Lives in `src/features/trello-import/`.
- **`planImport`** — pure, the testable heart. Takes the parsed board + a per-list classification and
  produces the `SeedNode[]`, the set of tags to register, and the `ImportReport`. **This is where NAM is
  "smarter than Trello"**, and it's covered by fixture-based unit tests.
- **Apply** — the wizard dispatches the existing `seedProject` under `projectsNodeId` (and/or
  `nextActionsNodeId` for loose actions), plus `registerTag` for new tags. No new insert mutation.

The only **new domain surface** is the provenance field (below) and a small `importTrello`-style
convenience that bundles the dispatches — or the page just dispatches the existing intents directly.

### The classification model (presets are just defaults)

Trello lists are ambiguous — a list can mean a *status*, a *work area/project*, a *context*, or the
*inbox*. NAM should not pretend it knows; the wizard lets the user classify each list, with smart
defaults from a chosen **preset**:

| Preset | Meaning | Default per-list classification |
| --- | --- | --- |
| **A — Board as one project** (default) | Board → a NAM project; lists become groupings/statuses under it | lists → child projects, cards → actions |
| **B — Lists as projects** | Lists are real work areas | each list → child project, its cards → child actions |
| **C — Lists as status columns** | Classic Kanban | lists matched to `Backlog`/`Next`/`Done` by name → status; others → project |

Per-list classification options: **Project**, **Status: Backlog / Next / Done**, **Inbox**, **Tag**,
**Skip**. The preset pre-fills these; the user adjusts before import. (Name heuristics seed the guesses,
e.g. `Backlog`/`To Do`/`Doing`/`Done`/`Inbox`/`Waiting For`.)

### Card and checklist mapping

- **Card → action** by default; **→ project** when it carries checklist items (Trello users nest
  checklists *because* Trello lacks projects — NAM liberates that structure). Heuristic is overridable.
- **Checklist items → child actions** (the settled default). **Checked → `DONE`**; unchecked → the
  status implied by the list (else `BACKLOG`). A card with **multiple checklists** → each checklist
  becomes a sub-project grouping its items; a single checklist promotes its items directly.
- A **"keep checklists in description"** toggle preserves the original text instead of promoting.

### Field mapping table

| Trello | NAM |
| --- | --- |
| Board | Project (preset A) or workspace-level grouping |
| List | Project / status / inbox / tag / skip (per classification) |
| Card | Action, or Project if it has checklist items |
| Checklist item | Child action (checked → DONE) |
| Label (named) | Tag (registered); unnamed/color-only label → skipped (noted) |
| Due date (`due`) | `dueAt` |
| `dueComplete` | reported; card status leans DONE |
| Description (`desc`) | `description` |
| Attachment | Typed `resource` (URI) — link, not a blob |
| Archived/closed card | Skipped (counted in report) |
| Members, comments, activity | Skipped (counted in report) |

### Provenance (settled: include now)

Each imported node stores where it came from:

```ts
// on NamNode (optional)
source?: {
  trello: { boardId: string; listId: string; cardId: string; cardUrl: string; importedAt: string }
}
```

**Contract note (must coordinate with NamDesktop).** Like bookmarks, the workspace is a single **JSONB
blob shared with NamDesktop** (see the suite note in `Aha43/NamDesktop#424`). Adding `source` to
`NamNode` is a shared-contract addition: NamDesktop must **preserve unknown JSON fields** on save (or
mirror the field) so a desktop edit doesn't strip provenance. Lower-stakes than bookmarks — losing
provenance degrades re-import/report but doesn't corrupt user data — but we file a NamDesktop heads-up.

### Migration report (the trust-builder)

After planning (before *and* after apply), show a report so the migration feels serious:

```
Imported:
- 1 board · 7 lists · 84 cards · 31 checklist items
- 12 due dates · 19 labels → 9 tags · 8 attachments as links
- 5 cards promoted to projects (had checklists)

Skipped / notes:
- 4 archived cards skipped
- 3 color-only labels skipped
- 2 checklists had duplicate item names
```

## Wizard UX

A new route (e.g. `/import/trello`), reachable from **onboarding (empty workspace)** and from
**Account/Settings → Import**. Steps:

1. **Load** — drop/upload a `.json` file, or paste JSON; or **"Use a sample board."** (Help explains how
   to get the JSON: append `.json` to a board URL while logged in, or paste it.)
2. **Classify** — pick a preset (A/B/C), then review/adjust each list's classification.
3. **Preview** — the resulting project/action tree + the migration report; choose checklist mode.
4. **Import** — dispatch `seedProject`/`registerTag`; show the post-import report with a link into the
   new project(s).

**Demo:** the JSON path works fully in the demo (local `applyIntent`), so "Try the demo → import the
sample board" is the test path — no account needed.

## Alternatives considered

- **Live Trello API connect (token popup + board listing).** Smoother UX and enables board discovery,
  but needs a registered Trello API key and token handling, and isn't demoable without a real Trello
  account. The interpretation engine is identical, so we ship JSON first and add this as a fast-follow.
- **Ongoing sync / Power-Up.** Rejected: would reshape NAM toward Trello's flat-card model; the whole
  point is to *reinterpret*, then own.
- **Import attachments as blobs.** No — preserve as external `resource` links first (also fits the
  future evidence/artifact direction); blob storage is a separate concern.

## Testing

- `parseTrelloBoard` — fixtures (a realistic board JSON, plus edge cases: archived cards, color-only
  labels, multiple checklists, missing fields).
- `planImport` — the bulk of the coverage: each preset, per-list classifications, card promotion,
  checklist → child actions (checked→DONE), label→tag, due, attachments→resources, archived skipped,
  report counts. Pure, fast, deterministic.
- Wizard component test — classify → preview → apply dispatches the expected `seedProject`/`registerTag`.
- A demo/e2e smoke: import the sample board, land in the new project.

## Delivery (MVP → one auto-sprint)

1. **Trello types + `parseTrelloBoard`** + a sample board fixture.
2. **`planImport` engine** (classification model, all mappings, report) — fully unit-tested.
3. **`source` provenance** field on `NamNode` (+ carried through `seedProject` seeds) + **NamDesktop
   heads-up issue** for field preservation.
4. **Import wizard** route (load → classify → preview → apply) + Account/onboarding entry.
5. **Sample board** for demo + **Help** section + **CHANGELOG**.

### Fast-follow backlog
- Live **Connect Trello** (token popup, board listing, fetch) reusing `planImport` unchanged.
- **Re-import / dedupe** using provenance (skip already-imported `cardId`s; drift report).
- **Export back to Trello** — only if collaboration ever needs it.
