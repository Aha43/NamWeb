# Releasing NamWeb

NamWeb follows [Semantic Versioning](https://semver.org/). `package.json` `version` is the single
source of truth (the app reads it at build time and shows it as the in-app version badge, alongside
the build commit SHA — see #464). Pre-1.0 (`0.MINOR.PATCH`): minor = features (breaking changes
allowed), patch = fixes. Reserve `1.0.0` for when the web surface and the Supabase contract are
stable.

## When to release (cadence)

**Merging is not releasing.** Every merge to `main` is continuously deployed by Cloudflare Pages and
identified by its build commit SHA (shown in the in-app version badge) — no version bump needed for
it to ship. A *version* is a deliberate milestone you cut when a batch of work is worth naming and
changelogging. A **sprint is the natural unit** for that.

Pre-1.0 cadence:

| Bump | When | Example |
| --- | --- | --- |
| **Minor** (`0.x.0`) | End of a sprint / batch of features — the default | `0.1.0 → 0.2.0` |
| **Patch** (`0.x.y`) | An off-cycle fix released on its own between sprints | `0.2.0 → 0.2.1` |
| **Major** (`x.0.0`) | Not used pre-1.0 — breaking changes ride in minors until 1.0.0 | — |

Entries accumulate under `## [Unreleased]` as PRs merge (every non-chore PR adds one); cutting a
release just renames that section. A single off-cycle bug fix only earns a patch release if it's
worth *announcing* — otherwise let it ride on `main` (already deployed) and fold it into the next
sprint's minor.

Go to **1.0.0** when the web surface and the Supabase contract are stable enough that breaking them
is a real event; after that, normal SemVer applies (breaking → major).

## Code review cadence (Codex)

Codex reviews have been high-signal here (e.g. the v0.3.1 batch caught a sync data-loss bug that
passed every automated gate). But their yield tracks **new logic-heavy code**, not calendar time —
so trigger them on **change**, not a clock. Lean toward *more* often; the thresholds below are low.

`.codex-review` (repo root) records the last commit covered by a review. "What's changed since" is
then a one-liner. **Run a Codex review when any of these holds:**

1. **Before cutting any release** (mandatory).
2. **A high-yield layer changed** since the last review — review now, don't wait for the release.
   These are where the costly bugs live (the v0.3.1 sync + global-shortcut bugs were both here):
   ```bash
   git diff --name-only "$(cat .codex-review)"..main -- \
     src/store src/sync src/domain/mutations.ts src/auth src/shell/useGlobalShortcuts.ts
   ```
3. **Volume crossed a low bar** — roughly ≥ 200 changed lines under `src/`, or ≥ 2 merged feature PRs:
   ```bash
   git diff --shortstat "$(cat .codex-review)"..main -- src/
   ```

Scope each review to the **diff since `.codex-review`** (not all of `main`) to keep signal high and
cost down. After addressing the findings, update `.codex-review` to the reviewed `main` HEAD and
commit it. Reviews **complement** the test gate — they find logic bugs the suite can't; the suite
finds flakes/regressions a point-in-time review can't.

## Tutorial freshness (NamProduct)

NamWeb is the source of UX change; the NamProduct "learn nam" site carries screenshot **slideshow
tutorials** that go stale when a screen here changes. Same shape as the Codex cadence above —
marker-driven, triggered on **change**, not a clock. The marker `.tutorials-synced` (repo root)
records the last `main` commit whose UX was reflected in the tutorials.

**Run `/refresh-tutorials` when any of these holds:**

1. **Before cutting any release** (mandatory) — a release is a natural "is the learn-nam site still
   accurate?" checkpoint.
2. **A user-visible surface changed** since the marker — a view, the clarify/triage flow, the
   workbench, Focus, etc. (Internal-only changes — sync, auth plumbing — don't move tutorials.)
3. **Volume crossed the same low bar** as Codex — roughly ≥ 200 changed `src/` lines or ≥ 2 merged
   feature PRs:
   ```bash
   git diff --shortstat "$(cat .tutorials-synced)"..main -- src/
   ```

The skill diffs since the marker, maps the change to affected tutorials
(`src/tutorials/staleness.ts`), regenerates their screenshots from the demo workspace
(`npm run tutorials:build`), opens a refresh issue in `Aha43/NamProduct`, and advances the marker.
Full design: `docs/features/tutorial-sync/design.md`. This is **not** a CI gate — it produces assets
and a downstream issue.

## Cutting a release

0. **Run a Codex review first** (see *Code review cadence*) and address any findings, then update
   `.codex-review`.
0.5. **Run `/refresh-tutorials`** (see *Tutorial freshness*) so the NamProduct tutorials reflect this
   release's UX; address the regenerated slideshows and update `.tutorials-synced`.
1. **Open a release PR** off `main`:
   - Bump the version: `npm version <X.Y.Z> --no-git-tag-version` (updates `package.json` +
     `package-lock.json`).
   - In `CHANGELOG.md`, rename `## [Unreleased]` to `## [X.Y.Z] - YYYY-MM-DD`, add a fresh empty
     `## [Unreleased]` above it, and update the link definitions at the bottom
     (`[Unreleased]` compare range + a new `[X.Y.Z]` tag link).
   - Merge once `check` is green.

2. **Tag the release commit on `main`** (annotated) and push the tag:
   ```bash
   git checkout main && git pull
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin vX.Y.Z
   ```

3. The **`release.yml`** workflow fires on the `v*` tag: it verifies the tag matches
   `package.json`, extracts the matching `CHANGELOG.md` section, and publishes a **GitHub Release**
   with those notes.

That's it — Cloudflare Pages continues to build/deploy from `main` as usual; the tag only drives the
GitHub Release.
