# Ops runbooks — "when X, do Y"

> Status: **growing (started 2026-06-16).** Operational and cross-product procedures for running
> live NamWeb. Companion to the [topology map](./production-topology.md) (what's wired up) and the
> [go-live playbook](./go-live-playbook.md) (how it was built). Each runbook is a concrete
> situation + the steps to handle it. Started as part of the **DevOps 1** sprint; more entries
> (rollback, bad migration, paused project, …) are added as we work the scenario queue.

---

## Cross-product: sharing one workspace between web and desktop

NamWeb and NamDesktop are separate apps that share **only the Supabase backend**. The same user can
work on the **same workspace** from both — but it pays to understand the rules first.

**Shared context (read once, applies to both runbooks below):**

- **One account.** Both apps sign in to the **same Supabase account** (email + password). The
  workspace is the row `(owner_user_id = you, name = "default")`. NamWeb's `VITE_WORKSPACE_NAME` and
  NamDesktop's `CloudSyncSettings.WORKSPACE_DEFAULT` are both `default`, so they line up.
- **Accounts are created on the web only.** NamWeb has sign-up + email confirmation; **NamDesktop
  can only *sign in*** (it has no sign-up, and prod requires a confirmed email). So whichever app
  holds your *data* first, the *account* is always made on NamWeb.
- **Sync is whole-workspace replace, not merge.** Push uploads your whole workspace; Pull downloads
  and replaces your whole local copy. There is **no field-level merge**. An optimistic `version`
  counter guards against silently clobbering a newer copy (you get a conflict prompt instead).
- **Same document shape.** A workspace created by either app is structurally identical (root "NAM" →
  Inbox/Projects/Actions, `formatVersion: 1`), so the other app reads it cleanly.
- **Production connection details (NamDesktop Settings → Cloud sync):**
  - Supabase URL: `https://erdzgbycvouarwppbzkn.supabase.co`
  - Publishable key: the prod `sb_publishable_…` (Supabase dashboard → Project Settings → API)
  - (NamDesktop's *defaults* point at the local dev stack `127.0.0.1:54321` — you must override them.)

---

### Runbook 1 — Use NamDesktop with a workspace you created in NamWeb

You started on the web, have a workspace at `usenam.app`, and now want the desktop app on it.

1. **NamDesktop → Settings → Cloud sync (Supabase):**
   - ✅ "Push and pull the workspace via Supabase"
   - **Supabase URL** + **Publishable key** → the prod values above
   - **Email / Password** → your NamWeb account
   - Save.
2. Click the **Pull** button (cloud-download icon, toolbar). Desktop signs in, fetches your
   `default` row, and loads it.
3. You're synced. Thereafter: **Push** (Cmd+S) sends local changes up; **Pull** brings web changes
   down.

**⚠️ Gotchas**
- **Pull-first, not Push-first.** Pulling adopts the web workspace. If you Push from a fresh desktop
  by mistake it's safe — you'll get a *Keep remote / Keep local / Cancel* conflict dialog; choose
  **Keep remote** to pull the web copy.
- **Pull overwrites local with no confirmation** today — fine for a fresh desktop, but if you
  already had local desktop work, Pull discards it silently. Fix tracked: NamDesktop#380.

---

### Runbook 2 — Use NamWeb with a workspace you created in NamDesktop

You started on the desktop, have a local workspace, and now want it on the web. The order matters.

1. **Create your account on NamWeb first** — sign up at `usenam.app` and confirm the email.
   (Desktop can't make accounts.) **Do not** click **"Create workspace"** yet — see the gotcha.
2. **NamDesktop → Settings → Cloud sync:** point at prod (URL + key) and enter that account's
   email/password (as in Runbook 1).
3. **NamDesktop → Push** (Cmd+S). With no remote row yet, this **inserts** your local workspace as
   the `default` row.
4. **Reload NamWeb.** It pulls the `default` row and your desktop workspace appears.

**⚠️ Gotchas**
- **Don't click "Create workspace" on the web** before pushing from desktop. It creates an *empty*
  `default` row, which makes your desktop Push **conflict**. Recoverable (the conflict dialog →
  **Keep local** pushes desktop over the empty one), but avoid it by pushing from desktop first.
- **The web no-workspace screen won't auto-refresh** after a desktop Push — reload the page to pick
  up the freshly-pushed workspace. Improvement tracked: NamWeb#143 (an "Already have a workspace?
  Refresh" path + auto-detect). Related: NamDesktop#381 (guided "sign in & pull" setup).

---

## More runbooks (queued)

Incident/ops scenarios to capture next: **bad deploy / rollback · bad migration or data loss ·
Supabase project paused (free tier) · site down / diagnosis · user can't sign up or didn't get the
confirmation email · GDPR data export / delete request · leaked secret rotation · new-contributor
onboarding.**
