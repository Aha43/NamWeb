# Go-live playbook — taking a Vite SPA + Supabase live on Cloudflare

> Status: **lived runbook (2026-06-16).** Written the night NamWeb went live at
> [`usenam.app`](https://usenam.app), while the steps and traps were fresh. This is the
> **journey** (how to stand it up from zero, plus the gotchas); the **map** of the resulting
> system is [`production-topology.md`](./production-topology.md). The forward-looking go-live
> *checklist* is [`../features/launch/design.md`](../features/launch/design.md).

## Who this is for

1. **Future me, fixing NamWeb** — "how was this set up again?" when something breaks.
2. **The next web project** — this is a reusable skeleton. The phase order and the gotchas
   transfer to any *static SPA + Supabase + Cloudflare Pages + custom domain* launch.

**How to read it:** each phase is **generic steps** + **⚠️ gotchas we actually hit**. Lines tagged
`[NamWeb]` are project-specific (swap them for the next project); everything else is the reusable
skeleton.

## The shape of the system (one sentence)

A static SPA (built by Vite) is served by Cloudflare Pages on a custom domain, and the browser
talks **directly** to a hosted Supabase project (Postgres + Auth + RLS) — there is no backend of
our own. So **RLS is the only thing protecting data**, and **all app config travels as build-time
`VITE_*` env vars** baked into the bundle.

---

## Phase 0 — Prerequisites

- A Git repo with a Vite build (`npm run build` → `dist/`) and CI you trust.
- Accounts: **Supabase**, **Cloudflare** (these become production infrastructure — see the
  ownership note at the end).
- The `supabase` CLI installed (`supabase --version`).
- `[NamWeb]` The database **schema lives in a separate repo** (NamDesktop owns the migrations);
  NamWeb is only a client of the same Supabase project. Know where your migrations live.

---

## Phase 1 — Production backend (Supabase)

1. **Create a hosted Supabase project.** Pick the **region deliberately** — `[NamWeb]` **EU**
   (GDPR / EEA users).
   - **Plan:** free is fine to *stand up and learn*, but know its two production traps:
     it **pauses after ~7 days idle**, and it has **no point-in-time recovery (backups)**.
     Plan to graduate to Pro before real users land. (Until then, off-platform `pg_dump` backups
     are your only safety net.)
   - At creation you may be asked about table exposure / RLS defaults: **enable RLS-by-default**
     (it's the only data guard here), and **leave "auto-expose new tables to the Data API" at the
     default** that matches your local stack — flipping it can silently make the client unable to
     read your tables.

2. **Authenticate the CLI.**
   - ⚠️ **Gotcha:** `supabase login`'s browser flow fails in non-interactive/non-TTY shells, and
     even after a successful login `supabase link` may report *"Access token not provided."* The
     reliable path is a **Personal Access Token**: dashboard → **Account → Access Tokens →
     Generate**, then export it before linking:
     ```bash
     export SUPABASE_ACCESS_TOKEN=<token>          # bash/zsh
     $env:SUPABASE_ACCESS_TOKEN = "<token>"        # PowerShell
     ```

3. **Link + apply migrations** (run from wherever the migrations live — `[NamWeb]` the NamDesktop repo):
   ```bash
   supabase link --project-ref <ref>   # prompts for the DB password (set at project creation)
   supabase db push                    # applies migrations; confirm the list with Y
   ```

4. **RLS sanity check** in the SQL Editor — confirm RLS is on *and* the policies came along:
   ```sql
   select relname, relrowsecurity from pg_class  where relname = '<table>';
   select polname                 from pg_policy where polrelid = 'public.<table>'::regclass;
   ```
   Expect `relrowsecurity = true` and your owner-scoping policy. Also do a **positive** check later
   (a signed-in user can read its *own* rows) — RLS-on with missing grants would block the client.

5. **Capture for the SPA:** the **Project URL** and the **publishable key** (the newer client-safe
   key; replaces `anon`). **Never** ship the `service_role` / secret key.

---

## Phase 2 — Auth configuration

In **Authentication → URL Configuration**:

- **Site URL** → your production origin. `[NamWeb]` `https://usenam.app`.
  - ⚠️ **Gotcha (the expensive one):** Site URL **defaults to `http://localhost:3000`**.
    Every confirmation / reset / invite email link is built from it — so if you forget this,
    real users click a link that goes to **localhost** and fails. Symptom we hit:
    `localhost refused to connect` after clicking the confirm email. (The account *is* still
    verified — Supabase's `/auth/v1/verify` runs server-side first, then redirects — but the
    redirect is broken.) **Set it, save, reload, and confirm it stuck.**
  - **Site URL** and the **Redirect URLs** allow-list are *two separate fields*. Set both.
    `[NamWeb]` redirect URLs: `https://usenam.app/**` and `http://localhost:5173/**` (local dev).

In **Authentication → Sign In / Providers**:

- **Allow new users to sign up = ON** (self-serve needs it).
- **Confirm email = ON.**
- Expand the **Email** provider → **Minimum password length** (`[NamWeb]` 8) + password rules.
  - ⚠️ Minor gotcha: password length is *inside* the Email provider, not in the top toggles.

- **Custom SMTP:** the built-in mailer is **dev-only / heavily rate-limited**. For real sign-up
  volume, configure a custom sender (`[NamWeb]` Resend, EU) on a verified domain. *(Deferred until
  a domain sender exists — note it as a known gap.)*

---

## Phase 3 — SPA hosting (Cloudflare Pages)

1. **Find Pages.** ⚠️ **Gotcha:** the dashboard nav buries it under
   **Build → Compute → Workers & Pages** (no top-level "Pages").

2. **Create the project** → **Pages** → **Import an existing Git repository**.
   - ⚠️ **Gotcha (the fork that wastes an hour):** Cloudflare has merged Pages into the Workers
     build flow. If you land on a screen titled *"Worker project"* asking for a **deploy command**
     like `npx wrangler deploy`, **you're in the wrong flow** — that's for Workers and needs a
     `wrangler` config we don't have. Back out and choose **Pages → Import an existing Git
     repository**. The correct screen asks for **Build output directory**, *not* a deploy command.
   - ⚠️ **Gotcha:** if your repo doesn't appear, the **GitHub App's repository access is scoped** —
     use the "configure / manage repositories" link to grant the Cloudflare app access to the repo
     (and the **org**, if it lives under one). Private repos are fine; no need to make it public.

3. **Build settings:** framework preset **React (Vite)** (auto-fills the rest), or set manually:
   - Project name: lowercase, dashes only (`[NamWeb]` `namweb` → `namweb.pages.dev`).
   - Production branch: `main` · Build command: `npm run build` · Output directory: `dist`.

4. **Environment variables** (Production) — the build-time `VITE_*` config:
   - `[NamWeb]` `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_WORKSPACE_NAME=default`.
   - The publishable key is client-safe (ships in the bundle by design); the secret key never does.

5. **SPA routing fallback:** add `public/_redirects` with `/* /index.html 200` so deep links and
   hard refreshes don't 404 on the static host. (Vite copies `public/` into `dist/`.)

6. **Save and Deploy.** You get a `*.pages.dev` URL. Pages then **auto-deploys on every push to
   `main`** and adds a **preview deploy per PR** (it shows up as a PR check). No deploy GitHub
   Action needed — and no Cloudflare API token stored in the repo.

---

## Phase 4 — Custom domain

1. **Register the domain** — `[NamWeb]` at **Cloudflare Registrar** (at-cost, free WHOIS privacy),
   so domain + DNS + TLS + host live in one account. `[NamWeb]` `usenam.app` (`.app` forces HTTPS).
   - When searching, type the bare name (no `www.`, no `https://`); skip "Premium"-tagged names.

2. **Attach it to Pages:** project → **Custom domains** → **Set up a custom domain** → enter the
   domain. Because it's registered at Cloudflare, it **auto-creates the DNS record**
   (`CNAME @ → <project>.pages.dev`) — confirm to apply.
   - ⚠️ **Gotcha:** this is a **separate, easily-skipped step**. Skip it and the domain simply
     **doesn't resolve** — symptom: *"This site can't be reached"* / `Could not resolve host`
     (vs. a cert error, which would mean DNS is fine but TLS isn't ready yet).
   - ⚠️ The dashboard warns *"up to 48 hours"* — generic worst-case. With DNS already at Cloudflare
     it's usually **a few minutes**. Verify from outside the dashboard:
     ```bash
     dig +short <domain>                 # should return Cloudflare IPs
     curl -sS -I https://<domain>        # should be HTTP/2 200 with a valid cert
     ```

---

## Phase 5 — Verify (end-to-end smoke)

Run the **full chain against production**, not just "does the page load":

1. Sign up with a real, checkable email.
2. Confirm email arrives → click the link → it returns you to the **production domain** signed in
   (this is what catches a wrong Site URL).
3. The app reaches a usable state for a **brand-new user** — ⚠️ **Gotcha [NamWeb]:** a self-serve
   web app must **bootstrap its own first data** (NamWeb creates an empty workspace), not dead-end
   waiting on a sibling app. We shipped live with this bug and caught it here (#137). *Test as a
   genuinely new user, not your already-set-up account.*
4. Create something → confirm it **persists** (re-load; check the row in the DB).

If all five pass, you're live.

---

## Reusing this for the next web project

Keep the **phase order** (backend → auth → host → domain → verify) and **all the gotchas** — they're
provider-quirks, not project specifics. Swap every `[NamWeb]` line: the region, the domain, the
project name, the `VITE_*` vars, and where the schema lives. The two things most likely to bite
again, in any project: **the Supabase Site URL localhost default** and **the Cloudflare
Workers-vs-Pages fork**.

## Known gaps at first go-live (NamWeb, 2026-06-16)

- **SMTP** on the free built-in mailer (rate-limited) — Resend pending.
- **Turnstile** bot-protection is in the code but **inactive** (no `VITE_TURNSTILE_SITE_KEY` yet).
- **Free plan** — will pause when idle; no PITR. Pro is the graduation step before soft launch.
- **No staging** — local dev + prod only.
- Privacy/ToS pages are **placeholder copy** pending legal review.

These are tracked in the **DevOps 1** sprint and the launch runbook.
