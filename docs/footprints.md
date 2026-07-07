# Release footprints

The **"footprint since last release"** paragraph reported at every cut (a ritual since v0.4.0,
codified in [RELEASING.md](RELEASING.md)) — archived verbatim, newest first, for historical
analysis: themes over time, converging-vs-polishing calls, and process experiments as they
happened. This is deliberately *not* the CHANGELOG: the CHANGELOG says what shipped; a footprint
says what the work *was about*.

Releases before v0.9.0 (v0.4.0–v0.8.0) predate this archive — their footprints were reported in
chat only. Their CHANGELOG summary lines are the surviving record.

---

## v1.0.0 — 2026-07-07

*(one day; 6 PRs, 1 release — the release)* A milestone earned, not declared. The road to the
number ran through a deliberately boring diff — a docs archive, two hygiene fixes, a stale-issue
audit that closed three epics the code had quietly finished long ago (onboarding, Learn NAM,
i18n) — because the decision itself was the work: **1.0 stamps the foundation, not a feature**,
cut from the quietest point in the repo's history rather than after the next splash. The gate
turned out to be anything but ceremonial: the dual review's second full cycle found six more real
issues with — again — zero overlap between reviewers, including a P1 that every automated gate
was structurally blind to: committed merge-conflict markers sitting in the CHANGELOG, aimed
directly at the 1.0.0 release notes. (The fix shipped with a permanent gate; prose is no longer
ungated.) Even the one eternal ghost got exorcised on the way — the phantom Account/Settings
navigation, root-caused by automation as sheet-slide tap-through and fixed twice over as both
reviewers sharpened the guard. The verdict written into the version number: the
capture→clarify→work loop, the sync core, the shared contract, and the quality machine around
them are trusted. **1.x belongs to the calendar era; 2.0 is the day an AI works this app over
MCP.** The foundation era is closed — by shipping it.

## v0.10.0 — 2026-07-06

*(hours after v0.9.1, same day; 4 PRs, 1 release)* A release that **opened a frontier** — the
first new capability arc since the wizard, and it shipped as a textbook dependency chain:
generalize the browser (folders → files, #660), use it to give links an address
(`nam://action/<id>` riding the URI enum because the desktop contract said no new enum values,
#661), then the human rules on top (link-to-here, the Link back offer, #662). The engineering
story of the day, though, was the **two-reviewer experiment**: an independent Claude review and a
Codex review of the same code produced six real findings with *zero overlap* — Claude took
logic-flow and UX correctness (the buffer-clobber, the edit-discard on link-follow), Codex took
lifecycle edges and rendering (endpoint revalidation, the phone toolbar overflow) — and Codex
cross-verified every one of Claude's fixes. All six landed in one hardening PR (#664) before the
cut. Verdict on the arc: **frontier opened, deliberately unpolished** — dogfooding over
speculation for the next round of linked-cards UX (visibility outside the editor, affordance
placement), and the dual-review gate looks like it's earned a permanent place before big cuts.
Three releases in one day (0.9.1 → 0.10.0), and the backlog ahead is the real epics: recurring
actions and the calendar grid.

## v0.9.1 — 2026-07-06

*(one day after v0.9.0; 5 PRs, 1 release)* A **listening** release — every line of it traces
directly to using the app and reporting back. The deck stopped ending brutally and learned to
walk the selection (#649, "exactly what I wanted"); the flicker report turned out to be a real
display-rewind in the sync core, caught precisely because the "symptom of something serious?"
instinct was trusted (#652); and "in progress" went from thinking-out-loud — *is it a status? no,
it's both backlog and in-progress* — to a shipped domain concept, the first **system tag**, with
a generic mechanism behind it (#653). The Codex gate ran its fourth cycle and delivered its
now-standard verdict shape: one real finding (desktop-cased tags, #655 — notably a cross-app
contract edge no web-only test would catch) plus explicit clearance of the scariest code (the
sync-burst interleavings). Theme-wise this was **pure polish and deepening** of the
capture→clarify arc — no new frontier opened, but the clarify loop is now genuinely
round-trip-free: capture, process, mark what you're on, and nothing flickers.

## v0.9.0 — 2026-07-05

*(one day, 2026-07-04 → 07-05; 8 PRs across three sprints, 1 release)* This was a **convergence**
release in the purest sense — almost nothing new was invented; instead, two ideas that proved
themselves were made universal. The wizard, born as an experiment in the capture dialog (#637),
was validated by use within hours ("a better way!"), extracted into a shared component, and sent
back to replace its own ancestor — the inbox verb toolbar it had originally copied (#643). The
circle closed in a day. Bookmarks ran the same arc in parallel: reorder (#638) begat in-menu
management (#639), which begat the cleanup of the dead strip and its orphaned setting (#640),
which begat one unified menu look down into the picker (#644). Two design principles hardened
into house rules along the way: *dead-weight affordances hinder learning* (a setting deleted days
after shipping, without regret), and *validate-by-use before propagating* (the wizard earned its
universality first). The Codex gate ran its third cycle and found two real edge cases (#646) —
including confirming a suspicion the handover brief itself had raised. Verdict: the
capture→clarify workflow that started as "nice to see the latest" on July 4th is now the
structural center of NamWeb, and it's **polishing**, not searching. The open backlog is back to
genuine epics (recurring actions, calendar) — the next sprint gets to pick a new frontier.
