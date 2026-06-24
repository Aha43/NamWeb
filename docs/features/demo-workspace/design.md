# Demo workspace — design

> Status: **Scope settled in discussion (2026-06-24); ready to implement.** See *Decisions settled* below.
> Promotes an idea raised while dogfooding: let people *see how NAM works* without signing up first.

## Why this exists

Today the very first thing NamWeb shows a stranger is a **sign-in / sign-up wall** (`App.tsx` gates on
a Supabase session → `AuthScreen`). For a tool whose whole pitch is "it's light and quick," asking for
an account *before you've seen a single screen* is the wrong order — most curious visitors bounce.

We want a **zero-friction "try it" path**: click once, land in a populated workspace, and play with the
real app — capture, clarify, Focus, tags, projects — with no account and no commitment. It doubles as
the best possible explainer (a live workspace beats screenshots) and as the top of the sign-up funnel.

This complements (does not replace) [`../web-account-onboarding/design.md`](../web-account-onboarding/design.md):
onboarding is "make it easy to *get* an account"; this is "let people *experience the product* before
they decide to."

## Scope

### In (MVP)
- A **"Try the demo"** entry from the auth screen, plus a shareable **`/demo`** URL.
- A **local-only** demo workspace: the real UI, fed a **seeded document held client-side**, with
  `dispatch` applying intents locally via `applyIntent`. **No Supabase, no auth, no network.**
- **Persistence:** the demo document is saved to **localStorage** so a refresh keeps the visitor's
  tinkering; a **"Reset demo"** control restores the seed.
- **Seed content:** relatable, everyday-life projects (e.g. *Vacation in Italy*, *Getting a dog*) with
  realistic actions, tags, due dates, a blocked item, and a sub-project — **plus the existing Learn NAM
  project** — so every view lights up and the methodology is teachable. (Details below.)
- A persistent, dismissible **demo banner**: *"You're in a demo — changes stay on this device. Sign up
  to keep your work."* with a **Sign up** call-to-action.

### Out (later / explicitly not now)
- **Importing the demo into a new account on sign-up.** Tempting funnel win, but it couples the demo to
  the real onboarding/auth flow. Deferred — note it as a fast-follow once the demo lands.
- **Server-side / shared demo, or per-visitor anonymous Supabase users.** Rejected (see Alternatives).
- **MCP, data export, account management** inside the demo — those need a real account; hidden in demo.

## How it fits the architecture

The app already separates the three things `AuthedApp` provides — a **user**, a **workspace**, and the
routed UI — and the **domain layer is transport-free** (`applyIntent`, lenses, and the seed builders
`buildLearnNam` / `emptyDocument` need no backend). `WorkspaceContext` is the seam the tests already
mock. So the demo reuses essentially the entire app; only the data source changes.

- **Entry / routing.** `App.tsx` currently renders `AuthScreen` when there's no session. Add a
  **demo mode** (a `/demo` route and a "Try the demo" button on `AuthScreen`) that mounts a demo app
  tree instead of the auth wall — no session required.
- **Demo app tree.** Mirror `AuthedApp`, but:
  - Provide a **synthetic demo user** to `AuthUserContext` (`{ id: 'demo', … }`) so user-keyed bits
    (e.g. the Get-Started dismissal keyed by `user.id`) work without a real account.
  - Replace `WorkspaceProvider` (which runs `useWorkspace` → Supabase pull/push) with a
    **`DemoWorkspaceProvider`** that supplies the same `WorkspaceContext` value shape
    (`{ document, dispatch, loading:false, error:null, noRemote:false, creating:false, … }`) where
    `dispatch(intent)` = `setDoc((d) => applyIntent(d, intent))` and the doc is persisted to
    localStorage. Keep `CaptureProvider` / `ActionEditorProvider` / `AppRoutes` as-is.
- **What's disabled in demo.** Account/Settings-destructive surfaces, MCP, and data export are hidden
  or routed to the sign-up CTA. Everything in the core loop (Inbox/capture, Next, Backlog, Due,
  Blocked, Done, Projects/Workbench, Tags, Search, Focus) works unchanged.

Because the domain is pure, the demo runs the **same code paths** as the real app — it's a faithful
preview, not a mock.

## Seed content

A curated, versioned **`buildDemo` seed** (a sibling to `buildLearnNam`, living in `src/domain/`), so
the copy is reviewable and easy to tweak. Chosen so every surface has something *and* it shows off the
tag rub-off:

- **🇮🇹 Vacation in Italy** — project, tag `travel`
  - Book flights — NEXT, due this week · Reserve hotel — NEXT · Pay deposit — BACKLOG, **blocked by**
    "Reserve hotel" · Pick dates — DONE · sub-project **Packing** (Buy adapter, Refill meds)
- **🐶 Getting a dog** — project, tag `home`
  - Research breeds — NEXT · Visit the shelter — NEXT, due today · Puppy-proof the house — BACKLOG
- **A few free actions** tagged `@phone` / `@errand` — fill Next + Tags
- **Due dates** spread overdue / today / week / later — the Due groups
- **📚 Learn NAM** — the existing `buildLearnNam` project, for the methodology

Project tags (`travel`, `home`) surface as **italic inherited chips** on their actions, so the demo
demonstrates rub-off and tag-filtering on real content.

## Decisions settled (2026-06-24)
- **Local-only, no backend, no account.** Reuse the app via the `WorkspaceContext` seam + a synthetic user.
- **Persistence = localStorage + a "Reset demo" button.** Survives refresh; one click back to pristine.
- **Seed = everyday-life projects *and* Learn NAM** — relatable first impression + teachable method.
- **Entry = "Try the demo" on the auth screen + a shareable `/demo` URL.**

## Open questions
- **Sign-up → keep your work:** on account creation from inside the demo, do we offer to import the
  demo document (or the user's edits) into the new workspace? (Deferred; fast-follow.)
- **Discoverability:** is the demo only reachable from the auth screen, or also linked from a marketing
  surface / the eventual landing page?
- **Reset scope:** does "Reset demo" also clear the Get-Started/onboarding dismissal and any per-view
  local prefs set during the session, or just the document?

## Alternatives considered
- **Shared Supabase demo workspace** (one row everyone reads/writes): visitors clobber each other;
  obvious abuse/spam magnet. ✗
- **Per-visitor anonymous Supabase auth** (throwaway user + seeded workspace each): real and roams
  across reloads, but creates a DB row per visitor → cleanup, cost, and an abuse surface; more infra
  for no demo-relevant benefit. Reasonable *later* if we ever want shareable demo links that persist
  server-side. ✗ for MVP.
- **Local-only (chosen):** instant, free, zero abuse surface, nothing to clean up. Tradeoff: edits are
  per-device and reset if storage is cleared — exactly the right semantics for a demo.

## Implementation sketch (for the sprint)
1. `buildDemo` seed in `src/domain/` (+ unit test that it produces a valid, populated document).
2. `DemoWorkspaceProvider` supplying `WorkspaceContext` from localStorage-backed state via `applyIntent`,
   with a `resetDemo()`; a synthetic `AuthUserContext` value.
3. Demo entry: `/demo` route + "Try the demo" button on `AuthScreen`; a `DemoApp` tree mirroring `AuthedApp`.
4. Demo banner (sign-up CTA + Reset) shown only in demo mode; hide account/MCP/export surfaces.
5. Tests: provider applies intents + persists/reset; an e2e that enters `/demo` and runs capture →
   Focus on seeded content with no auth.
