# Internationalization (I18N) — design

> Status: **Shipped (2026-07-01). Framework = react-i18next; en + nb, 465 keys, en/nb parity.**
> Every user-facing surface is translated — chrome/nav, Inbox, all action lists, Focus, the editor +
> capture, Projects (workbench/column/pickers/delete), Tags + Search, Account/Settings/Help, and the
> cross-cutting shared components (Copy/Confirm/Prompt/Bookmarks/theme) + relative date words. English
> is byte-identical (every pre-existing test passed untouched across all surfaces); `npm run i18n:check`
> guards en/nb parity.
>
> **Known small follow-ups:** (1) sync-notice message *text* (`src/store/*` — rarely seen, needs `t`
> threaded through the commit/store layer); (2) `formatDate` month abbreviations (`MONTHS` in
> `src/lib/dates.ts`) for the `medium` format. Neither blocks the bilingual experience.

## Phase C — shared `domain.*` vocabulary + NamDesktop coordination

The `domain.*` keys (12: the surface names + statuses) are the shareable subset. Phase C promotes them
from a naming convention into an **explicit versioned artifact**:

- **NamWeb side (this repo):** `translation.json` stays the source of truth; `scripts/export-domain-vocab.mjs`
  (`npm run i18n:export-domain`) emits `shared/i18n/domain.{en,nb}.json` (ICU-message JSON), and
  `npm run i18n:check` fails if they drift (CI-enforced). Contract documented in `shared/i18n/README.md`.
- **NamDesktop side:** a coordination issue tracks vendoring these files and formatting via **ICU4J**
  (`com.ibm.icu.text.MessageFormat`), so the shared vocabulary renders identically in both apps.

## Spike outcome (2026-07-01) — decision: **react-i18next**, not Lingui

The day-1 spike wired **Lingui** (the original recommendation) end-to-end on one screen. It compiled
in the Vite **build** and `lingui extract` produced clean `.po` catalogs — but its `<Trans>`/`t`
**babel macros do not transform under Vitest** (Vitest transforms JSX with esbuild, bypassing the
react-plugin's babel), so every i18n component threw in the unit suite. For a 600-test, test-locale-
`en` codebase that's disqualifying.

Two facts settled it on **react-i18next** (the doc's own pre-approved fallback):
1. **Runtime-only — no macro/transform** → identical behaviour in the Vite build and Vitest; i18n
   init lives in the test setup so components using `useTranslation` need **no per-test provider**
   (the "near-zero test churn" goal). Proven: the converted screen + an ICU plural test render en+nb
   with the full suite green.
2. **NamDesktop is Java, not .NET** (a mistaken premise below — it's Jackson/Java). Java has
   **ICU4J**, which consumes **ICU MessageFormat natively**, so ICU-in-JSON (react-i18next +
   `i18next-icu`) is a *better* shared-source fit than `.po` — removing Lingui's main advantage.

**Kept from the plan:** dotted ID-style keys with a separate `domain.*` subset; English hand-authored
in `en/translation.json` (byte-identical to the old literals) with tests pinned to `en`; ICU plurals;
language as a device setting. Catalogs are `.json` (ICU messages), shared with NamDesktop via ICU4J
rather than gettext.

**Tooling:** a small ICU-aware **`npm run i18n:check`** (`scripts/check-i18n.mjs`) is the safety net —
it verifies every literal `t('key')` used in the app has an `en` entry and that `nb` is in key-parity
with `en`. (i18next-parser was tried first but it force-expands `count` into i18next `_one`/`_other`
plural keys, which collides with our single-key ICU plurals — so a purpose-built check is cleaner.)

> Note: sections below that say "Lingui" / ".NET" / ".po" reflect the *pre-spike* recommendation and
> are superseded by this outcome; they're kept for the reasoning trail.

## Why this exists

NAM is English-only today — every user-facing string is an inline literal in a component. The author
wants **Norwegian** as a first additional language (the author's own), picked in **Settings**, and —
because NamDesktop will localize too — a way to **not maintain two divergent translation sets** for
the domain vocabulary the two apps share (Inbox, Next, Backlog, Done, Project, Focus, …).

So this is two things: (1) make NamWeb translatable and ship **en + nb**, and (2) establish a
**translation format + key scheme** that a shared English→Norwegian source can flow into both apps.

## Scope

### In (the I18N sprint)
- An **i18n framework** + a translation **catalog** (English = master) with **Norwegian (nb)**.
- **Externalize every user-facing string** — visible text, placeholders, `aria-label`s, tooltips,
  confirm/empty/error copy — from components into the catalog.
- A **language picker in Settings → Preferences**, persisted device-level (like `dateFormat`), with a
  sensible default from the browser locale; set `<html lang>`.
- **ICU message support** for the app's interpolation and **plurals** (e.g. "1 item" / "5 items",
  "Delete N selected actions").
- A **key scheme** that separates a shareable **`domain.*`** vocabulary from web-only UI strings, so
  the domain subset can later feed NamDesktop.

### Out (later / explicitly not now)
- **The live cross-repo translation pipeline** (auto-syncing catalogs into NamDesktop). This sprint
  establishes the *format + naming*; wiring the actual shared source is a follow-up once one app's
  catalog is real (see *Sharing with NamDesktop*).
- **More languages** beyond en + nb. The framework makes adding them cheap; we just don't translate
  them yet.
- **RTL layout.** nb and en are both LTR; defer RTL plumbing until a RTL language is on the table.
- **Locale-driven date/number reformatting.** `dateFormat` stays an independent explicit preference
  (see *Interaction with existing settings*).

## How it fits the architecture

- **Build:** Vite + `@vitejs/plugin-react` (**babel**-based) — so a babel macro–based i18n lib drops in
  cleanly.
- **Settings:** language is a **device-level preference**, exactly like the existing `dateFormat`
  (`SettingsProvider` → localStorage, with a no-provider fallback). Add `language` + `setLanguage`
  to `SettingsContextValue`, persist under a `namweb.settings.language` key, default by detecting
  `navigator.language` (`nb`/`no*` → `nb`, else `en`). The i18n runtime's active locale is driven by
  this setting; changing it re-renders the tree.
- **Strings live in catalogs, not components.** Components call a `t()` / `<Trans>` from the chosen
  lib; the catalogs (`src/locales/en.*`, `src/locales/nb.*`) hold the messages.
- **Domain layer stays string-free where it already is.** Lenses/intents don't produce user copy; the
  few domain-ish labels (status names, seed titles like "Inbox"/"Learn NAM") need deciding — seed
  *content* (demo/Learn-NAM project text) is data, not UI chrome, and likely stays English for now
  (note as an open question).

## Decisions

### Framework — recommend **Lingui** (with react-i18next as the fallback)

The dominant cost of this feature is **extracting hundreds of strings** across every component, and
the distinctive requirement is **sharing with a .NET app**. That points to Lingui:

- **`lingui extract`** scans the code and builds the catalog automatically — turning the extraction
  slog into a tool-assisted pass (and `lingui extract` flags any new untranslated string in CI).
- **Native ICU MessageFormat** (plurals/select) — the same message syntax .NET can consume.
- **`.po` (gettext) or JSON catalogs** — `.po` is the most portable format to .NET (which has gettext
  readers), making the shared-source story realistic.
- **Small runtime**, and the **babel macro** (`@lingui/babel-plugin-lingui-macro`) fits our
  babel-based Vite React plugin.

Trade-off: Lingui adds a macro/build step and its `<Trans>`/`t` macros. If that proves awkward with
our Vite setup, **react-i18next** is the fallback — more ubiquitous, `useTranslation`/`Trans`, lazy
namespaces, ICU via `i18next-icu`; catalogs are JSON (still shareable, just less .NET-native than
`.po`). **Settle this with a short spike on day one of the sprint** (wire one screen end-to-end in
both, compare). The rest of this doc is framework-agnostic.

### Key scheme

Namespaced, dotted, **ID-style** keys (not English-as-key) so translations are stable when English
wording changes:

- **`domain.*`** — the vocabulary shared with NamDesktop: `domain.status.next`, `domain.status.backlog`,
  `domain.status.done`, `domain.inbox`, `domain.project`, `domain.focus`, … This subset is the
  candidate shared source.
- **`<surface>.*`** — web-only UI: `inbox.empty`, `focus.markDone`, `editor.save`, `a11y.deleteX`, …
- **ICU** for interpolation/plurals: `actions.selectedCount` = `{count, plural, one {# selected} other {# selected}}`.

### English values == current literals (so tests & a11y don't churn)

Critical constraint: the **English catalog values must be byte-identical to today's strings.** Tests
assert on English copy (`getByRole('button', { name: 'Save' })`, `getByText('Inbox zero…')`,
aria-labels), and the test runtime will pin locale to **en**. If English values match, the giant
extraction lands with **near-zero test churn** — the win that makes this sprint tractable. Tests stay
in English; a small set of explicit nb tests cover the switching mechanism + a few representative
strings.

### Settings + `<html lang>`

A **Language** select in `Settings → Preferences` (next to Date format). On change: update the
setting, the i18n active locale, and `document.documentElement.lang`. Default detected from
`navigator.language` on first run.

### Interaction with existing settings

`dateFormat` (and `formatDate`) stay an **independent explicit preference** — `dates.ts` doesn't use
`Intl`/locale today, and we won't make language silently reformat dates. (Future option: offer a
"match my language" date default; out of scope.)

## Sharing with NamDesktop

The two apps have **different, mostly non-overlapping** string sets; only the **domain vocabulary**
overlaps. So "sharing" = a **shared source for `domain.*`**, English-master + nb, that both consume —
not one giant shared catalog.

- **Format:** ICU messages in **`.po`/JSON**, keyed by the `domain.*` ids. Portable to .NET (gettext
  reader, or a build step → `.resx`).
- **Where it lives:** TBD with the NamDesktop side — a small shared **`nam-translations`** location
  (a folder synced between repos, or a lightweight published package). NamWeb consumes it directly;
  NamDesktop consumes via its localization layer.
- **This sprint:** keep `domain.*` cleanly separated and authored as if it were the shared source, so
  promoting it later is a move, not a rewrite. **File a NamDesktop counterpart issue** to design its
  consumption (there is likely already an I18N issue there — coordinate, like we did for bookmarks in
  `Aha43/NamDesktop#424`). The live pipeline is a deliberate follow-up.

## Testing

- **Default test locale = en**, so existing assertions (English copy + aria-labels) keep passing —
  the extraction is validated by the suite staying green.
- New tests: the **language setting** persists + flips the active locale; a handful of **nb** strings
  render when switched (incl. one **plural** and one **interpolated/aria** string); `<html lang>`
  updates.
- CI: `lingui extract --check` (or equivalent) fails the build on an un-extracted/missing string, so
  new English literals can't sneak in untranslated.

## Delivery (its own sprint — rough phases)

1. **Spike + framework decision** (Lingui vs react-i18next), wired end-to-end on one screen; lock the
   key scheme, ICU, the en-values-match-literals rule, and the test-locale=en setup.
2. **Settings:** `language` preference + picker + `<html lang>` + browser-locale default.
3. **Extraction sweep:** move every user-facing string into the catalog, surface by surface
   (shell/nav, Inbox, Next, Backlog, Due, Blocked, Done, Projects/Workbench, Tags, Search, Focus,
   editor, capture, Account/Settings, Help, empty/error/confirm copy, aria-labels). English values
   identical to today.
4. **Norwegian (nb):** translate the catalog; QA each surface in nb.
5. **`domain.*` separation** finalized + **NamDesktop coordination issue** for the shared source.

### Fast-follow / later
- The **live shared-translation pipeline** with NamDesktop.
- Additional languages; locale-aware date/number defaults; RTL.

## Alternatives considered
- **react-i18next** — the fallback (ubiquitous, JSON catalogs, lazy namespaces). Chosen against as the
  default only because Lingui's extraction tooling + native ICU + `.po` portability fit the
  big-extraction + share-with-.NET goals better. Revisit in the spike.
- **Homegrown `t()` + JSON maps** — tempting for a small app, but reinvents plurals/ICU, extraction,
  and the missing-string safety net. Rejected.
- **Translating in place / machine-translation only** — no; we want a real catalog the desktop can
  share and a human-checked nb.
