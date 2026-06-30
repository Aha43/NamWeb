# Tutorial-sync routine — design

> Status: **Built (2026-06-30).** Closes #495. A change-driven loop that keeps NamProduct's
> "learn nam" tutorials in step with NamWeb's UX.

## Why this exists

NamWeb is the **source of UX change** — screens evolve as features land. NamProduct (the
"promotion / learn nam" site) carries screenshot **slideshow tutorials** (e.g. *"how to process
items in the inbox"*). The two are separate repos with no link, so when a screen changes here the
downstream tutorials silently go stale, and refreshing them depends on someone remembering to.

This builds the missing feedback loop, reusing what already exists: the durable signal for "what
changed" is `CHANGELOG.md [Unreleased]` (every non-chore PR adds an entry) plus the git diff since a
marker — exactly the inputs the **Codex review cadence** already uses (`docs/RELEASING.md`,
`.codex-review`). We mirror that cadence so it feels native: marker-driven, triggered on *change*,
mandatory before a release cut.

The screenshot capability already exists too — the curated **demo workspace** (`buildDemo()`), the
network-mocked Playwright plumbing, deep-link routes, and accessibility-first selectors. We point
them at a tutorial catalog instead of assertions.

## How it fits the architecture

```
NamWeb change merged ──▶ CHANGELOG [Unreleased] + git diff since .tutorials-synced
        │
        ▼
/refresh-tutorials  (skill)  ── or the mandatory release-cut step
        │  1. diff names + changelog text since .tutorials-synced
        │  2. map changed surfaces ─▶ affected tutorials   (src/tutorials/staleness.ts, unit-tested)
        │  3. regenerate screenshots  (npm run tutorials:build → Playwright drives the demo)
        │  4. open a refresh issue in Aha43/NamProduct (loose coupling)
        │  5. advance .tutorials-synced to main HEAD
        ▼
NamProduct issue: "Refresh process-inbox — inbox/clarify changed (NamWeb a0dcf64..<sha>)" + assets
```

**Generation lives in NamWeb** (the only place that renders the app); **NamProduct only consumes.**
Clean split, no shared application code — same boundary NamWeb already has with NamDesktop.

## The pieces

| Piece | Path | Role |
| --- | --- | --- |
| **Catalog** | `src/tutorials/catalog.ts` | Declarative tutorials: `id`, `title`, `viewports`, `surfaces`, `slides` (shot slug + caption). Single source of truth. |
| **Staleness mapper** | `src/tutorials/staleness.ts` (+ `.test.ts`) | Pure `affectedTutorials(changedPaths, changelogText)` → which tutorials a change may have made stale, and the surfaces that flagged each. |
| **Capture harness** | `e2e/tutorials/capture.spec.ts` | Drives `buildDemo()` through the real authed app (Supabase mocked) and screenshots each slide at desktop + phone. New Playwright projects `tutorials-desktop` / `tutorials-phone`. |
| **Slideshow assembler** | `tutorials/build-slideshow.ts` | Pairs each slide caption with its PNG → `tutorials/output/<id>/slideshow.md` (plain Markdown NamProduct can render). |
| **Marker** | `.tutorials-synced` | Last `main` commit whose UX is reflected in the tutorials. Exact analogue of `.codex-review`. |
| **Skill** | `.claude/skills/refresh-tutorials/SKILL.md` | Chains diff → map → regenerate → NamProduct issue → advance marker. |
| **Release wiring** | `docs/RELEASING.md` | *Tutorial freshness* section + step 0.5 in *Cutting a release* (mandatory, like Codex). |

### `surfaces` — how a change maps to a tutorial
Each tutorial lists `surfaces`: a mix of **source-path globs** (`src/**/Inbox*`) matched against the
files changed since the marker, and **lowercase keywords** (`inbox`, `clarify`, `triage`) matched
against the `[Unreleased]` text. Any match flags the tutorial. The mapper **proposes** — keywords are
deliberately loose; the skill run (a human) confirms before regenerating and opening the issue. This
keeps the catalog cheap to maintain: when you add a tutorial, you list the surfaces it depends on.

## Design decisions

- **Why placed under `src/tutorials/`** (catalog + mapper) rather than a top-level `tutorials/` dir:
  it gets the existing gates for free — typechecked by `tsconfig` (`include: ["src"]`) and unit-tested
  by vitest (`src/**`) with **no shared-config edits**. Nothing in the app imports it, so it is never
  bundled. The Playwright spec stays under `e2e/` (Playwright's domain); only the node assembler and
  the git-ignored `output/` live in the top-level `tutorials/`.
- **Why the authed app (mocked), not `/demo`:** the demo route is for visitors and carries a demo
  banner; driving the same curated `buildDemo()` seed through the mocked authed app gives the same
  content with clean chrome — better marketing screenshots — and lets the harness reuse the existing
  `mockedTest` fixture and deep-link navigation.
- **Why a GitHub issue, not a PR, into NamProduct:** loose coupling. The routine needs nothing about
  NamProduct's internals to file "these tutorials drifted, here's why, here are the assets." Can be
  tightened to a PR later if NamProduct's layout is brought into the loop.
- **Why no scheduled cloud routine:** triggers are release-cut + on-demand only (the user's call). A
  cron adds noise without the human-in-the-loop confirmation the mapper's loose keywords want.

## Out of scope
- A scheduled/cron trigger.
- NamProduct-side rendering of the slideshows (it consumes `slideshow.md` + PNGs however it likes).
- Auto-embedding images into the NamProduct issue (the `gh` CLI can't upload issue images; the skill
  links/pushes assets instead).

## Verification
- `npm run test` — `src/tutorials/staleness.test.ts` covers the glob mechanics and the mapping.
- `npm run tutorials:build` — captures `process-inbox` at both viewports and writes its slideshow;
  no backend needed. The capture failing is itself the signal a tutorial's steps drifted.
- `npm run e2e:mocked` stays green and **excludes** the `tutorials-*` projects (assets, not a gate).
