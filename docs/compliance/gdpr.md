# GDPR / privacy readiness — Nam

> **Status: living checklist, drafted 2026-06-15. NOT legal advice.**
> This is an engineering/product readiness map — what GDPR asks of Nam, what's already in place, and
> what's missing — so we don't build into a corner. It does **not** make Nam compliant and is **no
> substitute for a lawyer / DPO sign-off.** Nam operates from **Norway (EEA)**, so the GDPR applies
> (implemented nationally via *personopplysningsloven*; supervisory authority: **Datatilsynet**).

## Why this exists

Nam is becoming a public, self-serve web product (see
[`../features/web-account-onboarding/design.md`](../features/web-account-onboarding/design.md)) that
stores users' personal data in the cloud and — via the remote-MCP connector — can send a user's
workspace content to third-party AI providers. That combination puts real GDPR obligations on the
table. The data-export idea (for account deletion) surfaced the broader question; this doc captures it
**before** account flows ship.

## Roles

- **Controller:** Nam / Arne Halvorsen (decides the purposes and means of processing).
- **Processors / sub-processors:** Supabase (auth, database, hosting), the email/SMTP sender (later),
  and — see the wrinkle below — the AI providers (OpenAI / Anthropic) reached through the connector.

## Personal data inventory (what Nam holds)

| Data | Where | Notes |
|---|---|---|
| Email address | `auth.users` (Supabase) | Identifier + contact; also invited friends' emails (third-party). |
| Password | `auth.users` | Hashed by Supabase Auth — Nam never stores plaintext. |
| User id (uuid) | `auth.users`, `workspaces.owner_user_id` | Pseudonymous key. |
| Workspace content | `workspaces.document` (JSONB) | **User-generated; may contain personal data** the user typed (names, notes). |
| Auth/session + access logs | Supabase / host logs | IP, timestamps, user agent. |
| OAuth tokens (MCP) | `mcp` schema | Hold the user's Supabase session at rest (already off-PostgREST). |

**Data minimisation is already decent** — Nam asks for little beyond an email and the user's own content.

## Lawful basis (Art. 6)

- **Core service** (account, sync, the app working): *performance of a contract* — Art. 6(1)(b).
- **Optional** marketing / analytics, if ever added: *consent* — Art. 6(1)(a), separately and revocably.
- **Invites:** processing the invited person's email rests on the inviter providing it; keep it to the
  invite purpose and don't retain beyond it.

## Data-subject rights → how Nam fulfils them

| Right (GDPR) | Nam mechanism | Status |
|---|---|---|
| Access (Art. 15) | "Export my data" (JSON) | **Planned (P0/P1)** ✓ |
| Portability (Art. 20) | Same JSON export (machine-readable) | **Planned** ✓ |
| Erasure (Art. 17) | Hard account deletion | **Planned (P1)** ✓ |
| Rectification (Art. 16) | Edit email/profile on the Account page | **Planned (P0 shell)** ✓ |
| Restriction / objection (Art. 18/21) | Account deletion + (later) consent toggles | Partial |
| Withdraw consent (Art. 7) | Only relevant once consent-based features exist | N/A yet |

The export + hard-delete decisions already line up well with access/portability/erasure.

## The Nam-specific wrinkle: the AI connector 🔍

The remote-MCP connector deliberately sends a user's **workspace content to OpenAI / Anthropic** when
they use it. GDPR implications:

- **International transfer** (US providers) → needs a valid mechanism (EU–US Data Privacy Framework
  adequacy and/or SCCs).
- **Sub-processor relationship** → ideally under a DPA; and there's a genuine **legal nuance** on
  whether, for connector traffic, Nam is the controller transferring data or merely a conduit the user
  directs to *their own* ChatGPT/Claude. **(Needs a lawyer.)**
- **Transparency** → regardless of the above, the privacy policy must clearly state that using the
  connector sends workspace content to the chosen AI provider. The consent page already says "let this
  assistant read/modify"; the policy must make the data-flow explicit.

## International transfers & data residency

- **Decide the Supabase region before deploy.** Hosting the project in an **EU region** removes most
  transfer questions for the core data. Moving regions later is painful — settle it at the deploy step.
- US sub-processors (AI providers, possibly the email sender) still need a transfer basis.

## Retention

- Define how long data lives, especially **after deletion** (purge timelines for logs and backups).
- Hard-delete removes live data; document that backups age out within a stated window.

## Security (Art. 32)

- RLS by `owner_user_id`, hashed passwords, TLS, OAuth-gated connector, off-PostgREST token storage —
  good foundation.
- Add: a documented **breach-response** plan (Art. 33/34 — notify Datatilsynet within **72 hours**;
  notify affected users if high risk).

## Transparency & consent obligations

- **Privacy policy** (mandatory): data collected, purposes + lawful basis, sub-processors, transfers,
  retention, rights, controller contact. *None exists yet.*
- **Terms of Service.**
- **Acceptance at sign-up** — a ToS/privacy checkbox (already noted in the onboarding security section).
- **Age** — Norway's digital-consent age is **13**; sign-up should enforce a minimum age.
- **Cookies/analytics banner** — only if/when non-essential cookies or analytics are added.

## Invites & third-party data

Sending an invite processes the **invitee's** email (their personal data). Keep it purpose-limited
(send the invite, don't build a shadow contact list), don't leak whether they're already a user, and
cap/rate-limit to avoid being a spam tool.

## Possibly needed at scale (probably not yet)

- **Records of processing** (Art. 30) — lightweight for a small operation, but worth a one-pager.
- **DPIA** (Art. 35) — a data-protection impact assessment; likely not required for a task app, but the
  AI-connector data flow is the thing most likely to trigger a closer look. **(Flag for the lawyer.)**
- **DPO** (Art. 37) — almost certainly **not** required at indie scale.

## What threads into the product *now*

- **P0:** a **privacy-policy + ToS link and acceptance** (with an age check) at sign-up; frame
  **export** and **delete** as rights-fulfilment, not just features.
- **Deploy step:** choose an **EU Supabase region**; line up DPAs/SCCs for US sub-processors.
- **Connector:** ensure the privacy policy discloses the AI-provider data flow.

## Needs a human (decisions + legal sign-off)

- Controller-vs-conduit question for connector→AI transfers.
- Privacy-policy / ToS content (templated, but Arne owns the claims) — consider a Norwegian-law review.
- DPAs with Supabase + AI providers; transfer mechanism for US processors.
- Data residency (EU region) decision.
- Whether analytics/marketing will exist (drives consent/cookie work).

## Process note

Living document — update as the product and processors change. Drafted alongside the account-onboarding
epic; the **P0** threads above should be honoured when those flows are built so compliance is baked in,
not bolted on. Get a **real legal review before public launch / any monetisation.**
