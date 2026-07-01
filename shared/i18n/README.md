# Shared `domain.*` vocabulary

The **surface names and statuses** that NamWeb and [NamDesktop](https://github.com/Aha43/NamDesktop)
agree on — the common vocabulary a user sees in both apps (Inbox, Next, Backlog, Due, Blocked,
Projects, Goals, Templates, Tags, Search, Focus, Done). Part of the I18N epic (NamWeb #400, Phase C).

## Files

- `domain.en.json`, `domain.nb.json` — the `domain.*` keys per locale, as **ICU MessageFormat**
  strings in flat, dotted-id JSON (`"domain.status.next": "Next"`). Today they're all plain strings
  (no arguments), but the format is ICU so plural/interpolated shared messages can be added later.

## Contract

- **NamWeb is the source of truth.** These files are **generated** from
  `src/locales/{locale}/translation.json` — do not edit them by hand. Run `npm run i18n:export-domain`
  after changing any `domain.*` key, or `npm run i18n:check` (which fails if they've drifted — enforced
  in CI).
- **Keys are stable dotted ids**, decoupled from wording: English lives in the value, not the key, so
  rewording English never breaks a consumer.
- **Adding a locale:** add it to `src/locales/`, then to `LOCALES` in `scripts/domain-vocab.mjs`, and
  re-export.
- **Scope:** only genuinely shared domain vocabulary belongs under `domain.*`. App-specific UI copy
  stays in each app's own catalog (in NamWeb, the non-`domain.*` keys in `translation.json`).

## Consuming from NamDesktop (Java / ICU4J)

Vendor these JSON files and format with **ICU4J** (`com.ibm.icu.text.MessageFormat`) so the same
messages render identically on both sides. Tracked by the NamDesktop coordination issue linked from
NamWeb #400. Suggested flow: copy the files into the desktop resources (or a shared submodule), load
the map, and look up by the dotted key.
