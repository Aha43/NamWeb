# Going live — launch runbook & design

> Status: **runbook draft (2026-06-16).** The path to a public NamWeb. Doubles as a
> step-by-step checklist and a record of the launch decisions. Related:
> [`../web-account-onboarding/design.md`](../web-account-onboarding/design.md),
> [`../../compliance/gdpr.md`](../../compliance/gdpr.md), [`../remote-mcp/design.md`](../remote-mcp/design.md).

## Goal & reality

Take **NamWeb** (the primary product) from local-only to a **public, self-serve web app**. Account
onboarding P0+P1 is done; the remote-MCP connector is feature-complete through P4b. What's missing is
**infrastructure**: there is **no hosted backend yet** — both NamWeb and NamDesktop cloud-sync have only
ever run against the local Supabase stack. So launch stands up the **first hosted Supabase project**,
which becomes the production backend for **both** products. EEA/Norway → host it in the **EU**.

## Decisions to settle (owner: Arne)

| Decision | Recommendation | Status |
|---|---|---|
| Supabase region | **EU** (e.g. Frankfurt / Stockholm) — GDPR | open |
| SPA host | **Cloudflare Pages** or **Vercel** (trivial for a Vite SPA; CF pairs with a future Workers MCP) | open |
| Domain | — | open |
| Transactional email (SMTP) | **Resend** (EU region, simple) — for confirm/reset/invite mail | open |
| Bot protection | **Cloudflare Turnstile** (free) on sign-up | open |
| Analytics | none at launch (avoids a cookie-consent banner) | open |

## 1. Production backend — Supabase (the foundation)

1. **Create** a hosted Supabase project in an **EU region** (Arne's account). *(Only Arne can do this.)*
2. **Apply migrations** from **NamDesktop** (it owns the schema):
   `supabase link --project-ref <ref>` → `supabase db push` — applies workspaces, the unique index, the
   `supabase_realtime` publication, and `delete_my_account()` to the hosted DB.
3. **Auth config** (dashboard or `supabase config push`):
   - Site URL + `additional_redirect_urls` = the production domain (for confirm/reset links).
   - `enable_confirmations = true`, `minimum_password_length = 8` (already in local config.toml).
   - **Custom SMTP** sender (the built-in mailer is dev-only / heavily rate-limited).
4. Capture the project **URL + publishable (anon) key** for the SPA's prod env.
5. **RLS sanity check** on the hosted DB (the policies ride along in the migrations).

> Cross-product note: this hosted project is also NamDesktop cloud-sync's production backend. Point
> desktop at it when ready; the `workspaces` contract is unchanged.

## 2. SPA hosting + domain

- The SPA is a static Vite build (`npm run build` → `dist/`). Deploy to the chosen host with a
  **SPA-routing rewrite** (all paths → `index.html`, for client-side routing).
- **Prod env vars** on the host: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (the prod project),
  `VITE_WORKSPACE_NAME=default`.
- **Custom domain** + automatic HTTPS.
- A **deploy GitHub Action** (build on push to `main`, deploy to the host) — or the host's native git
  integration.
- Prod-readiness already in place: the dev test-credential prefill + dev-workspace toggle are
  `import.meta.env.DEV`-gated, so they don't ship.

## 3. GDPR go-live gate (must precede public launch — see `compliance/gdpr.md`)

- **Privacy policy** + **Terms of Service** pages (content owned by Arne; templated).
- **Acceptance + age (≥13) checkbox** at sign-up (wire into `AuthScreen`).
- **Bot protection** (Turnstile) on sign-up; keep the existing rate-limit posture.
- **EU data residency** (handled by §1).
- Privacy policy must disclose the **AI-connector data flow** (workspace content → OpenAI/Anthropic)
  once the MCP connector is also public.
- Documented **breach process** (72h) + **retention** note.

## 4. Pre-launch hardening

- Error monitoring (e.g. Sentry) — optional but worthwhile.
- Confirm transactional email deliverability from the real SMTP sender (SPF/DKIM on the domain).
- A smoke pass on the hosted stack: sign-up → confirm email → sign-in → reset → export → delete.

## 5. Launch

- **Soft launch to friends** via the **invite link** (the P1b feature) — gather feedback, fix, iterate.
- Then open public sign-up.

## Sequencing

1. Backend (§1) — gated on Arne creating the EU project.
2. SPA host + domain (§2).
3. GDPR gate (§3) — code I can do now (privacy/ToS pages + age/acceptance + Turnstile), content from Arne.
4. Hardening (§4) → soft launch → public (§5).

## Out of scope here

The **remote-MCP connector deploy** is a parallel track (its own hosting decision — Edge Functions /
Workers / Node) that reuses this hosted Supabase; it can follow the web launch. Send-from-app email
invites and data **import** (#129) are post-launch.

## Owner split

- **Arne (accounts/content):** create the EU Supabase project; pick host + domain + SMTP; privacy/ToS
  copy; DNS.
- **Claude (code/config):** apply migrations + auth config (guided), SPA deploy config + prod env +
  deploy Action, GDPR-gate code (age/acceptance + Turnstile + policy pages), smoke verification.

## Process note

Runbook — tick the steps as we go. Get a **real legal review** of the privacy policy / ToS before
public launch (see the GDPR doc).
