# Web App — Roadmap

> Status: **active.** Companion to `design.md` (which holds the original direction and the MVP
> decisions). The MVP foundation is shipped (issues #1–#10, #16–#22). This doc maps the work
> *after* the MVP: the area breakdown, the form-factor split, and the sprint plan that carries
> NamWeb's desktop-browser mode to functional parity with the Java NamDesktop app.

## Where we are

The MVP frontend foundation is complete and merged: email/password auth, three list surfaces
(Inbox / Next / Backlog), the Focus deck, an always-available capture sheet, and an adaptive
`PhoneShell` vs `DesktopShell` spine — all on a solid core (domain model + lenses, the Supabase
pull/push client, an optimistic single-flight commit store with conflict-retry).

The app is deliberately thin today. Everything below is the plan to grow it.

## The two form-factor super-categories

The form-factor split is already **architectural**, not just CSS: `PhoneShell` and `DesktopShell`
(#18) are separate components with different information architecture. The roadmap respects that.

- **💻 PC / laptop browser — the well-defined target.** It should work **basically as the Java
  NamDesktop app**: not a visual clone, but functional parity — someone who knows one knows the
  other, and nothing is missing. This is the bulk of the work: **several sprints**, sliced
  surface-by-surface to mirror NamDesktop.
- **📱 Phone — the ubiquitous companion.** Capture on the go, execute, glance at what's next.
  A smaller, separate track, planned in its own pass once the desktop spine is underway.
- **🔄 Shared core.** Domain, sync, store, auth, deploy, UI primitives — built once, both consume.

Sequencing: **balanced / shared-first** — build the shared foundation, then drive the
desktop-parity spine; the phone track gets its own later planning pass.

## Areas (planning buckets)

A — Capture & clarify · B — Triage & organize · C — Focus & execution · D — Navigation & search ·
E — Sync / offline / PWA · F — Auth & deployment · G — Design system & polish.

| Area | 📱 Mobile-led | 💻 Desktop-led | 🔄 Shared |
|---|:---:|:---:|:---:|
| A Capture & clarify | capture | rich clarify/edit dialog | edit mutations |
| B Triage & organize | | projects, hierarchy, tags, due, reorder, blocked | |
| C Focus & execution | swipe deck | | |
| D Navigation & search | More-sheet | sidebar, drill-down, search | |
| E Sync / offline / PWA | PWA install, offline | | sync core, workspace id |
| F Auth & deployment | | | ✓ |
| G Design system & polish | swipe/touch | hover/keyboard | tokens, states, primitives |

## Why the desktop track is low-risk: the data model is already done

NamWeb's `WorkspaceDocument` (`src/domain/types.ts`) **already fully mirrors the desktop JSON
blob** — `savedViews`, `missionControls`, `templates`, `viewOrders`, `registeredTags`, `Resource`,
`ProjectTemplate`, `TemplateNode` are all present. So the entire desktop-parity gap is **lenses +
mutations + UI — no schema work anywhere in the track.**

What exists today vs. the gap:

- **Lenses present:** `inboxItems`, `nextActions`, `backlogItems`, `projectPath` (`src/domain/lenses.ts`).
- **Mutations present:** `addInboxItem`, `convertInboxToNext`, `setStatus`, `deleteLeaf` (`src/domain/mutations.ts`).
- **Missing lenses:** projects, projectWorkbench, due, done, blocked, context (tag-filter),
  savedView, missionControl, search, plus `effectiveTags` (inherited tags) and `buildPath`.
- **Missing mutations:** `updateNode`, `setDue`, tags (`updateTags`/`add`/`remove`), kind-aware
  reorder, `moveNode` (reparent), `deleteRecursive`, `addSubProject`, convert inbox→project /
  action→project / project→action, prerequisites (+ cycle check), resources, saved-view CRUD,
  mission-control CRUD, templates (save/apply/delete), view-order reorder.

Parity is measured against NamDesktop (sibling repo): service ops in
`src/namdesktop/service/NamWorkspaceService.java` (~40 operations), lenses in
`src/namdesktop/lens/`, surfaces in `src/namdesktop/ui/*Panel.java` and `*Dialog.java`.

## Issue-management convention

NamDesktop organizes by **feature-area labels** (`docs/practices/issue-management.md`) and uses
**no GitHub milestones**. NamWeb adopts that label discipline **and** adds milestones, unified
under one rule:

> **Milestone ⇄ sprint ⇄ feature branch = 1:1.**
> One milestone per sprint. The sprint runs on a single feature branch named as a slug of the
> milestone. Every issue in the sprint belongs to that one milestone and is committed on that one
> branch (`Closes #N` per commit). The whole branch merges to `main` at sprint end.

- GitHub does not link a milestone to a branch — the tie is our convention, kept in sync by hand.
  Milestone titles stay human-readable; the branch is the slug. Each milestone's GitHub
  **description** records its branch name. Example: milestone `Sprint 1 — Edit foundation` ⇄ branch
  `feature/sprint-1-edit-foundation`.
- This adapts CLAUDE.md's per-issue-branch default: the branch now spans a whole sprint (many
  issues). "One issue at a time" still holds as the *commit cadence within* the branch.
- **Two labels per issue:** a *type* (`enhancement` / `bug`) + a *feature-area* label
  (create the label the first time a new area appears).
- **Issue body shape:** *What / Why / Suggested behavior / Notes*, with out-of-scope stated
  explicitly, and a *Related issues* cross-reference section. No sub-issues.
- Issues are authored in the direction/planning chat; implemented later in the dev chat.

## 💻 Desktop-browser parity track — sprint milestones

| Milestone (sprint) | Feature branch (1:1) | Scope | NamDesktop refs | Feature labels |
|---|---|---|---|---|
| **Sprint 1 — Edit foundation** | `feature/sprint-1-edit-foundation` | UI primitives; Action edit dialog + `updateNode`/`setDue`/`updateTags`; real workspace identity; logo on login | `ActionDialog`, `NamWorkspaceService` rename/setDue/updateTags | `editing`, `branding` |
| **Sprint 2 — Daily-workflow parity** | `feature/sprint-2-daily-workflow` | inbox Process dialog; status-badge menu; inline rename; kind-aware reorder; project-path/due/tags columns; FIFO/LIFO sort | `ProcessInboxDialog`, `NextActionsPanel`, `BacklogPanel` | `editing`, `views`, `time` |
| **Sprint 3 — Projects & hierarchy** | `feature/sprint-3-projects` | Projects list + Project Workbench (breadcrumb, sub-project sections, MCR heat-map); addSubProject; reparent; convert action↔project; deleteRecursive | `ProjectsPanel`, `ProjectWorkbenchPanel` | `projects` |
| **Sprint 4 — Done / Due / Blocked** | `feature/sprint-4-done-due-blocked` | Done (restore/backlog/delete); Due (overdue/today/week/later); Blocked grouped by blocker + prerequisites with cycle detection | `DonePanel`, `DueActionsPanel`, `BlockedPanel` | `views`, `prerequisites`, `time` |
| **Sprint 5 — Tags / Saved Views / Search** | `feature/sprint-5-tags-views-search` | Tag-filter (Context, AND, inherited italic); Saved Views CRUD; workspace Search | `ContextPanel`, `SavedViewPanel`, `SearchPanel` | `views`, `search` |
| **Sprint 6 — Mission Control + Templates** | `feature/sprint-6-mission-control-templates` | Goal Board heat-map dashboards; templates save/apply/delete | `MissionControlPanel`, `TemplatesDialog` | `mission-control`, `templates` |
| **Sprint 7 — Parity polish** | `feature/sprint-7-parity-polish` | Settings (dense mode, status-column, click-to-rename); keyboard shortcuts; resources on Action dialog; nav history | `SettingsDialog`, `ShortcutsDialog`, `ActionDialog` resources | `settings`, `navigation`, `resources` |
| **Auth & Deploy** | `feature/auth-and-deploy` | hosted Supabase + live URL; social login (#14) + identity-linking policy | — | `auth`, `deploy` |
| **Phone companion** | `feature/phone-companion` | capture-clarify, focus depth, glanceable next, PWA install/offline | — | `ui` |

The Auth & Deploy track runs alongside, starting after Sprint 1 (deployment unblocks dogfooding
on real devices). The Phone companion track is deferred to its own planning pass.

Each milestone is decomposed into per-surface issues at its own start — one sprint at a time, per
CLAUDE.md. Only Sprint 1 is broken out into issues initially.

## Change log

| Date | Change |
|---|---|
| 2026-06-10 | Roadmap created: areas + form-factor matrix + desktop-parity sprint milestones; milestone⇄sprint⇄branch 1:1 convention adopted. |
