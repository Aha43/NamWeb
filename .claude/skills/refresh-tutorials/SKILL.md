---
name: refresh-tutorials
description: Use when NamWeb UX has changed and the NamProduct "learn nam" tutorials may be stale — diffs since the .tutorials-synced marker, maps changed surfaces to affected tutorials, regenerates their screenshot slideshows from the demo workspace, and opens a refresh issue in Aha43/NamProduct. Also the mandatory pre-release tutorial-freshness check (docs/RELEASING.md).
argument-hint: "[base-ref] (defaults to the .tutorials-synced marker)"
---

# Refresh NamProduct tutorials after NamWeb UX change

NamWeb is the source of UX change; NamProduct carries the screenshot slideshow tutorials. This skill
is the change-driven loop that keeps them in sync (full design: `docs/features/tutorial-sync/design.md`).
It is modelled on the Codex review cadence (`docs/RELEASING.md`) — marker-driven, run on **change**.

The pieces it orchestrates already exist; this skill just chains them. Don't invent new behavior.

## Steps

1. **Find what changed since the last sync.** The marker `.tutorials-synced` (repo root) holds the
   last-synced `main` commit. Compute the change set:
   ```bash
   BASE="${1:-$(cat .tutorials-synced)}"
   git fetch origin main --quiet
   git diff --name-only "$BASE"..origin/main        # changed files
   git diff "$BASE"..origin/main -- CHANGELOG.md     # [Unreleased] entries added since
   ```
   If `git diff --shortstat "$BASE"..origin/main -- src/` shows nothing meaningful, stop: nothing to do.

2. **Map changed surfaces → affected tutorials.** Feed the changed paths and the `[Unreleased]`
   CHANGELOG text to the staleness mapper (`src/tutorials/staleness.ts` → `affectedTutorials`). The
   simplest path is a throwaway `tsx` snippet that imports `affectedTutorials` and prints the matched
   tutorial ids + the `matched` surfaces. The mapper **proposes** — keywords are intentionally loose,
   so eyeball the list and drop false positives before regenerating. If nothing matched, stop.

3. **Regenerate the affected tutorials.** Run the capture + assemble pipeline:
   ```bash
   npm run tutorials:build
   ```
   This drives the curated demo workspace (no backend) and writes
   `tutorials/output/<id>/{desktop,phone}/NN-<shot>.png` plus `tutorials/output/<id>/slideshow.md`.
   The output dir is git-ignored (regenerated). Eyeball the affected slideshows.
   - If a screen changed enough that a tutorial's **steps** no longer reach the right state, update the
     choreography in `e2e/tutorials/capture.spec.ts` and/or the slides in `src/tutorials/catalog.ts`,
     then re-run. (A capture failure here is itself the signal the tutorial drifted.)

4. **Open a refresh issue in NamProduct.** Loose coupling — one issue per refresh, listing the
   affected tutorials, *why* (the surfaces/CHANGELOG entries that flagged them), and where the
   regenerated assets are:
   ```bash
   gh issue create --repo Aha43/NamProduct \
     --title "Refresh tutorials: <surfaces> changed (NamWeb <short-range>)" \
     --body "<affected tutorial ids + titles> · <CHANGELOG [Unreleased] excerpts> · regenerate with \`npm run tutorials:build\` in NamWeb at <sha>"
   ```
   `gh` cannot upload images to an issue body. If NamProduct wants the PNGs embedded rather than
   regenerated on its side, push `tutorials/output/<id>/` to a branch and link it (or attach the
   slideshow.md), and say so in the issue. Confirm the repo is reachable
   (`gh repo view Aha43/NamProduct`) before posting; if not, surface that instead of guessing.

5. **Advance the marker.** Update `.tutorials-synced` to the `origin/main` HEAD you diffed against and
   commit it (`docs: sync tutorials marker`), so the next run's "what changed since" stays tight.

## Notes
- This is **not** a release gate and adds no CI; it produces assets and a downstream issue.
- Run it (a) on demand after a UX change, and (b) mandatorily before cutting a release — see the
  *Tutorial freshness* section of `docs/RELEASING.md`.
