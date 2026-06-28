---
name: ship
description: Use when the user asks to "ship", "deliver", or "open a PR for" a feature/issue — drives the full NamWeb delivery flow from feature branch through local gates, PR, and (only after CI is green) a squash-merge. Codifies the repo's Workflow + Delivery conventions so nothing is skipped.
argument-hint: <issue-number>
---

# Ship a feature to a merged, green PR

A wrapper around the delivery flow already documented in `CLAUDE.md` (**Workflow**, **Delivery**,
**Definition of Done**). This skill chains those steps — it does not invent new behavior. Read
`CLAUDE.md` first if anything below is ambiguous; that file is the source of truth.

Argument: `$1` = the GitHub issue number this work closes (optional; ask/confirm if absent).

## Steps

1. **Confirm an issue exists.** All work ties to a GitHub issue (`Closes #<n>`). If `$1` wasn't
   given and no issue covers this work, stop and agree on one with the user before continuing.

2. **Confirm the branch.** Never commit on `main` (it's branch-protected). Ensure you're on the
   *intended* descriptive feature branch for this issue — not a leftover branch from earlier work.
   If it doesn't exist yet, create it from an up-to-date `main`. Rename any default `feature/next`
   to something descriptive before opening the PR.

3. **Update the changelog.** Add an entry to the `## [Unreleased]` section of `CHANGELOG.md`
   (`Added` / `Changed` / `Fixed`).

4. **Run the local gates — all must pass before delivering:**
   ```bash
   npm run typecheck && npm run lint && npm run test && npm run e2e:mocked
   ```
   `npm run e2e:mocked` runs the **full** mocked suite (desktop + phone) — it does *not* run per-PR
   in CI, so local is the real gate against cross-feature drift. Fix anything red before proceeding.

5. **Commit & push.** Commit with `Closes #<n>` plus the standard co-author line, then push the
   feature branch.

6. **Open the PR** with `gh pr create`. Write the "how to test" around the **Try the demo** path for
   client-side changes (reserve "sign in and …" for auth / sync / Account / MCP changes). Fetch and
   post the **Cloudflare Pages branch-preview URL**:
   ```bash
   gh api repos/Aha43/NamWeb/commits/<sha>/check-runs \
     --jq '.check_runs[] | select(.name=="Cloudflare Pages") | .output.summary'
   ```
   Surface the `*.namweb.pages.dev` Branch Preview URL.

7. **Wait for CI green.** The `check` job (lint + typecheck + test + build) must pass:
   ```bash
   gh pr checks <#> --watch
   ```

8. **Merge — only after `check` is green and the user has tested the preview.** Merge is the one step
   that needs an explicit go-ahead (and during an **auto-sprint**, never merge — leave the PR open):
   ```bash
   gh pr merge <#> --squash --delete-branch
   ```

## Guardrails

- Never push directly to `main`; never merge before `check` is green.
- In **auto-sprint** mode, stop at step 7 (PR open with test notes + CF link) — do not merge.
- If a gate in step 4 fails, fix the root cause; don't skip the gate to deliver faster.
