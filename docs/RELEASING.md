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

## Cutting a release

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
