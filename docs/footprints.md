# Release footprints

The **"footprint since last release"** paragraph reported at every cut (a ritual since v0.4.0,
codified in [RELEASING.md](RELEASING.md)) — archived verbatim, newest first, for historical
analysis: themes over time, converging-vs-polishing calls, and process experiments as they
happened. This is deliberately *not* the CHANGELOG: the CHANGELOG says what shipped; a footprint
says what the work *was about*.

Releases before v0.9.0 (v0.4.0–v0.8.0) predate this archive — their footprints were reported in
chat only. Their CHANGELOG summary lines are the surviving record.

---

## v1.4.0 — 2026-07-11

*(one day; 6 PRs, 1 release)* The first release cut mid-dogfooding-holiday, and it reads like
one: three micro-sprints (one issue, one issue, two issues) each born from a concrete moment of
friction in the features the user leans on hardest. The blocked-by selector — "an old style
almost impossible to use flat list" — became the column browser (#728), and the review round
turned that swap into the cut's best finding: the browser was *usable but incomplete* (inbox
captures were valid candidates no column could reach — a dead-end picker), fixed at the lens so
the candidate set and the browsable set can never disagree again (#736), with a deliberate
product call recorded: clarify a capture first, then block on it. The summary export — the
user's handover artifact to his AI workflows — learned in-place editing with Regenerate as undo
(#730), then grew a discard guard when the reviewer weighed Escape across the new editor family
and found it heavier in one dialog than the others. Bookmarks took custom names ("Next sprint
(NamWeb)", "Economy of trip to Japan") over an already-stored label field that had been half a
feature since #560 (#734), tooltips now carrying the technical truth. Process note: the
sprint-planning prelude did real work this round — four user actions became two issues once the
overlap was seen, and the parallel merge train landed without a single CHANGELOG conflict.
Codex: second consecutive fully clean pass. Verdict: **polishing**, contentedly — the everyday
surfaces are absorbing dogfooding faster than it finds new arcs; the parked design items (#708
inverse holiday, projects in Due view, an Inbox browse column if the dropped workflow is
missed) wait for the next converging mood.

## v1.3.0 — 2026-07-10

*(two days; 6 PRs, 1 release)* Two small dogfooding sprints that share one instinct: **the
editor earns density**. First the loose ends real use exposed — URL resources became honest
links (display name riding the never-used `description` field, so nothing new syncs — the
contract-frugal choice over a `name:uri` encoding, #718), *in progress* learned to end when the
action does (#719), the inbox's glowing button finally explains itself (#717). Then the "meaty"
one: the editor's two bulkiest blocks went dense — resources as pure display rows with a "…"
opening type-appropriate dialogs (rows finally *editable*, #722), and the four-input due block
collapsed to the same one-line hint rows use, expandable on demand (#723) — with the user's
mid-review nudge (a ⌃ to collapse back, "the x + x trick is neat but not intuitive") folded in
before merge. The review dance produced a first: Claude's six findings (#725) included the
portal-bubbling submit bug found in a *sibling* control after the handover invited the hunt,
and a premise-rejection accepted mid-flight (Undo must restore the stripped mark — landed as a
replay-safe intent flag, not a UI patch); Codex then returned the archive's **first fully clean
pass**, five verdicts, zero findings. Verdict: **polishing**, deliberately — the calendar and
time arcs rest while everyday-editor friction burns down; the parked design items (#708 inverse
holiday, projects in Due view) are the next converging candidates.

## v1.2.0 — 2026-07-09

*(one day; 7 PRs, 1 release)* The cleanest arc the repo has run: **projects×time**, planned as a
deliberate tip-toe and walked in order — due-controls parity (#701), dates visible on rows
(#702), projects on the calendar (#704), then the design-flavored step got its design note
(#705, the repo's process honored mid-stride) before **derived project time** (#707) landed the
arc's idea: a project's span breathing from its contents, explicit dates winning per edge,
nothing derived ever written. The user's own instincts drove every design call — opt-in, the
holiday that starts before its first flight, "natural recursion always on my mind" — and the
feature shipped the day before a real holiday, its perfect dogfood. The quality machine ran the
full dance mid-arc and produced its best story yet: six findings, fourth consecutive
zero-overlap cycle, and one bug — a stale-draft clobber over remote edits — that **neither
reviewer saw whole**: Claude closed the cross-field path (#710), Codex the in-field path (#712),
the pincer only visible in retrospect. One finding was deliberately *not* fixed: the inverse
holiday (#708) waits for a design pass because it touches a shared contract convention —
restraint as a feature. Verdict: the time domain now spans actions **and** projects and is
**converged**; what remains (Due view, the inverse holiday) is known, small, and parked on
purpose.

## v1.1.0 — 2026-07-08

*(two days; 12 PRs, 1 release)* The 1.x thesis made good on its first page: the **calendar era**
went from "no calendar" to daily driver in five feature PRs — month grid, day drill-in,
ISO week gutter, plan-a-day-from-the-day, titles-on-hover — a textbook converging arc where each
PR made the previous one more useful. Around it, the first **dogfooding dividend**: four small
UX debts the user only saw by living in the app (a Focus button that scrolled away, loose actions
with no way into a project, over-promoted template tools, "did my sub-project get created?") fixed
in one parallel auto-sprint, branches deliberately anchored apart so the merge train needed one
trivial conflict resolution instead of last train's heading cleanup. The quality machine then ran
its full dance **mid-cycle for the first time** (not just at the gate): Claude review → 3 findings
→ fix PR → Codex review → 3 findings → fix PR — six real issues, third consecutive cycle with
**zero overlap** between reviewers, headlined by a domain gap (free actions had no move targets,
the very case the feature was built for) and a route crash from a hand-mangled URL. One finding
became infrastructure: `i18n:check` joined the per-PR CI gate, closing the drift class it caught.
Verdict: the calendar arc is **converging** fast; everything else is the polishing of a surface
that increasingly just works.

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
