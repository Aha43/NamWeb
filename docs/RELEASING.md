# Releasing NamWeb

NamWeb follows [Semantic Versioning](https://semver.org/). `package.json` `version` is the single
source of truth (the app reads it at build time and shows it as the in-app version badge, alongside
the build commit SHA — see #464). Pre-1.0 (`0.MINOR.PATCH`): minor = features (breaking changes
allowed), patch = fixes. Reserve `1.0.0` for when the web surface and the Supabase contract are
stable.

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
