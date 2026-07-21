# Release footprints

The **"footprint since last release"** paragraph reported at every cut (a ritual since v0.4.0,
codified in [RELEASING.md](RELEASING.md)) — archived verbatim, newest first, for historical
analysis: themes over time, converging-vs-polishing calls, and process experiments as they
happened. This is deliberately *not* the CHANGELOG: the CHANGELOG says what shipped; a footprint
says what the work *was about*.

Releases before v0.9.0 (v0.4.0–v0.8.0) predate this archive — their footprints were reported in
chat only. Their CHANGELOG summary lines are the surviving record.

---

## v1.12.1 — 2026-07-21

*(one substantive PR + the release chore, 1 release; off-cycle patch)* A single fix, but the deepest
of the sharing epic: the concurrent-drain data-loss bug (#850/#852) — the last blocker before real
multi-device sharing (2.0.0). The theme is **correctness under concurrency**, and the story is the
review dance itself. **Seven Codex rounds**, each surfacing a strictly deeper distributed-systems bug
as the previous was closed: floor-pruning double-apply → applied-bit ordering/durability → tombstone-GC
ABA → watermark cross-tab reordering → append-only-set non-commutative mis-order → advisory-lease
bypass/expiry → non-atomic fence race. Every fix was real, and the design *converged* rather than
thrashed — it ended where the problem always pointed: a server-side **per-share drain lease** (enforced,
fenced, atomic, self-renewing) that serializes drains so a compact per-resource **watermark** is correct
and bounded, with committed-truth planning and a leftover-reprocessing backstop. Emphatically converging
— the sharing pipe earning the right to leave Labs. It also stress-tested the dual-review dance to its
limit: no automated gate would have caught any of the seven, and each round's fix was verified before the
next was sought. The process note worth keeping: on a concurrent-writes-to-a-synced-blob layer — exactly
where costly bugs live — "one more round" kept paying, so diligence beat impatience every time. Next: the
shared-projects view + the unveiling (Share leaves Labs) → 2.0.0.

## v1.12.0 — 2026-07-20

*(one PR, 1 release; off-cycle)* Not a feature cut — a foundational one, and the first release
driven by a *sibling* project rather than NamWeb's own roadmap. **NamAdmin** was born (a
local-only admin tool: holds the service key on the operator's machine, talks only to the
Supabase Auth Admin API, never touches workspace data), and its user-delete needed one thing
from NamWeb's schema: `workspaces.owner_user_id` had no `ON DELETE CASCADE`, so deleting an auth
user failed on the FK. The fix cascaded it (matching `project_shares`), simplified
`delete_my_account` to the single mechanism, and — the durable part — wrote down the division of
labor: admin-operations-on-users live in NamAdmin, schema/RLS/migrations live in NamWeb, and any
table referencing `auth.users` must cascade. The migration was dual-verified (a rolled-back
behavioral cascade test on the local stack, then a clean prod apply behind a full `pg_dump`
backup). The review gate was a proportionate self-review — no client logic, just SQL + docs.
Two banked items still wait on real design passes: #832 (concurrent-drain loss, the 2.0.0
blocker) and strict syntactic tag-namespace reservation.

## v1.11.0 — 2026-07-19

*(one day; 4 PRs, 1 release)* A cleanup the user named at exactly the right moment: system tags
and user tags had always looked identical, and with sharing about to lean harder on tag-driven
visibility, the ambiguity was a latent trap. The fix reserved a `#` namespace for system tags —
and the interesting part was the sequencing decision. Rather than add a duplicate `shared-hide`
alongside `private`, we renamed `private` → `#shared-hide` (freeing the generic word), and did
the sigil refactor FIRST so the two new share-shape tags (`#shared-show`, `#shared-open`) were
born in their final form instead of named twice. Then the dual review did what it does: Claude
caught that a pre-existing user `#foo` tag would be bold-protected yet silently destroyed on any
write, and I "fixed" it by demoting unknown `#…` to plain — which Codex then showed was itself
broken TWO ways (non-idempotent: `#in progress` promotes to the system tag on a second pass;
cross-store split: a node demoted while the registry kept the old spelling). The real fix was to
stop rewriting tag data entirely — reserve the namespace *semantically* (registry-based
membership) not *syntactically*. That the strict "forbid the `#` character" version needs a
document migration is now a banked follow-up alongside #832. Two review rounds, and the second
found that the first round's fix was the bug — the exact value of not stopping at one reviewer.
The 2.0.0 unveiling stays banked (its blocker, #832, unchanged).

## v1.10.0 — 2026-07-18

*(one day; 6 PRs, 1 release)* The registry pattern paid off: the **Question** resource — a
tri-state yes/no — arrived as almost pure composition, reusing the counter epic's whole
guest-append / owner-drain machinery, and in doing so answered the design doc's open
`guestPolicy` question (auto-drain, no adopt ceremony) by the simple fact that "answer as
counter" needed nothing new. The load-bearing decision was making the answer a SET, not a
toggle — the pill computes tap-active-clears and dispatches the desired state, so the reducer
and the drain both just apply it. Alongside it, a one-line-of-intent change with an outsized
feel: guest pages open collapsed, turning the shared project from a brochure into an index.
But the cycle's real character was the dual review going three layers deep on the same seam.
Claude found the forward-compat trap (an old client claiming answer events it can't parse);
its fix protected the current bundle. Codex then found that fix insufficient — an already-open
old tab still holds direct table writes — and prescribed moving the whole claim/delete path
behind owner-scoped RPCs so old clients fail closed, which is what shipped. And beneath THAT,
Codex surfaced a genuine distributed-systems bug — concurrent same-resource drains losing an
event to the expectedValue guard no-opping a conflict-replay — that I deliberately did NOT
fix under review pressure, because every quick patch risked double-counting, worse than the
rare loss; it's filed (#832) as a sync-contract design task, banked against the 2.0.0
unveiling. Eighth and ninth zero-overlap review cycles; the pattern where the two reviewers
pincer one subsystem from different altitudes is now the norm, not the exception. The 2.0.0
unveiling stayed banked a fourth time — correctly, now with a named blocker.

## v1.9.0 — 2026-07-17

*(two days; 9 PRs, 1 release)* The cycle where a design premise fell in the best possible
way: "guests capture, never edit" met "she's responsible for the jar count" and bent instead
of breaking. The resource became the contract surface — the owner delegates a specific
counter, the guest exercises its registry-defined legal moves, and an events-not-state pipe
(guests append via quiet-false RPC, the owner's client drains into the document as ordinary
intents) kept the single-writer model pure through the whole thing. Everything after that
was the readiness use case pulling features into existence within hours of being spoken:
counters that complete their action at the goal and reopen when stock depletes, a
hide-completed toggle born from two live use cases disagreeing about done items, got-it
strikes in the grocery aisle. The dual review then earned its keep on the hardest code of
the epic — Claude caught completion firing on thresholds instead of crossings (guest ticks
silently overriding deliberate owner status decisions) plus a drain window that stranded
claimed ticks; Codex went deeper on the same seam and found deletion racing durability,
forgotten publish options, and check-then-insert cap races — seventh consecutive
zero-overlap cycle, and the first where both reviewers converged on the same subsystem from
different altitudes. Process scar: a stacked train taught (the hard way) that merging a base
auto-closes dependent PRs beyond reopening — retarget first, always. Still converging: the
2.0.0 unveiling stayed banked a third time; the pantry and the trip are now stress-testing
the same machinery from opposite ends.

## v1.8.0 — 2026-07-16

*(two days; 9 PRs, 1 release)* Two arcs that never touched each other's files, converging on
the same idea: **NAM starts talking to people who aren't its user.** The sharing lab ran three
deliberate "lab it, don't design it" iterations — a table of contents (overkill on purpose:
small, familiar), collapsible sections with anchor-aware unfolding, then the suggestion box
that closes the guest loop: a guest suggests, the owner adopts into the inbox with provenance,
and the guest never becomes a user. Meanwhile the resource family got its registry and its
first interactive member — counters ticked straight from the list, bidirectional for the
stock-keeping case the user brought mid-sprint, then an unlimited "goal, not a cap" mode two
days later when dogfooding plans outran the design. That rhythm — ship the small thing, let
use reshape it within the week — is the converging story. The dual review earned its keep
again on schedule: Claude's F1 (the suggestion cap counted handled rows — the box would go
permanently deaf, invisible to both sides, a bug only a real database could show) and Codex's
lone P2 (a stale tray across share reloads), zero overlap for the sixth straight cycle. Still
polishing wide; the 2.0.0 unveiling stayed deliberately unpulled — Share ships dark another
cycle.

## v1.7.0 — 2026-07-14

*(two days; 8 PRs, 1 release)* The arc nobody planned and everybody needed: **the phone**,
which had silently absorbed a year of desktop decisions. It opened with an audit — headless
390px screenshots that showed rows spending half their width on seven always-on icons, titles
truncating at fifteen characters — and the audit built the first three PRs (the "…" row
reclaim, the Filter-chip headers, the bottom-bar inbox cue). Then the user's first real
thumb-driven day did what audits can't: it found the bugs that only exist in the hand. His
keyboard's action key is a ✓ that blurs without ever firing Enter — which meant every inline
edit silently vanished (cancel-on-blur, inverted to commit) and the big + capture button was a
literal dead end (#626's buttonless purism, right on desktop, wrong on phones). Two hotfixes
and a standing audit rule later ("every phone form needs a visible submit or blur-commit"),
the review dance delivered its most self-reflective round yet: the HIGH finding was in the
suite itself — a phone e2e green only by losing a race, probing a control that was never in
the strip — alongside a blur-reflow dead tap on the exact gesture that ends an edit, and a
Filter chip whose silence compounded into an empty state that affirmatively lied ("all
clear!" over twelve hidden items). Codex added one P3 (aria-controls, fixed while the pattern
is young) and a phone-only advisory no headless browser can settle. Verdict: **the phone is
usable again and the pattern language is set** (primary verb out, secondaries behind "…";
disclosures that tell the truth) — M2 waits on the next pain list; the lab (sharing stages
3–4) waits on the operator.

## v1.6.0 — 2026-07-13

*(one day; 12 PRs, 1 release — the densest day in the repo's history)* The cut where the
project grew up twice at once. **Structurally**: NamDesktop parked, `supabase/` moved home,
the docs stopped saying "companion" — NamWeb simply is NAM now, and the migrations guard
proved itself immediately (a June grant fix turned out to live in prod's schema but not its
history; backfilled cleanly). **Ambitiously**: the 2.0.0 epic went from ratified design doc to
two shipped stages in a day — the sanitizer, the RPC-only security model (hardened mid-push
when a prod probe caught hosted default-privileges quietly undoing "no anon grants"), and the
guest page itself: a secret link now renders a real itinerary for a sister who will never hear
the word "server". All dark behind Labs; the trip project can be published today. In between,
a "boring" dogfooding sprint that wasn't: the inbox now glows red until processed, rows
compact on one flip (found missing from the workbench by the user within minutes — dogfooding
glasses beat audits), status boxes gave every list one mental model (the reviewer's favorite
verdict: "premise rejected, in the feature's favor — there is no add-vs-subtract split"). The
review dance ran its fullest round: six Claude findings — one a real constructible
private-date leak through derived spans, one a production-only bug (jsonb key reordering made
the freshness hint permanently dirty) that unit mocks *structurally cannot see* — then a
Codex P2 that killed the republish-resurrection path entirely. Process scars worth the
keeping: three CI burns from pipe-masked exit codes in one day ended that habit; hooks-before-
early-returns bit and was caught by journeys. Verdict: **converging hard** — the epic is two
stages from its unveiling, and the next arc is already named: the phone.

## v1.5.0 — 2026-07-12

*(one day; 7 PRs, 1 release)* The cut where bookmarks stopped being shortcuts and became the
app's **control surface** — and it started as a design conversation, not a plan: "focus speed
dial. Good idea? If so ideas on how to do?" The answer discovered the foundation already built
(focus scopes had been URL-addressable since the scoped-focus work — the planned three-issue
sprint shrank to two on contact with the code), and the dial shipped as a pure projection of
bookmarks: Focus ▾ on the desktop (#740), a target glyph per More-sheet row on the phone
(#741), zero new data model. The user's "now I get it" moment — *my bookmark appears there,
and Focus enters it as the deck* — validated the two-verbs-one-bookmark grammar (menus view,
dial deals). Dogfooding immediately sharpened it: a bookmarked context shouldn't land in the
Tags *workshop* (#748 — the bookmark view: your name as the title, chrome tucked away,
Next-only forced on because you came to do), and the keyboard caught up around it (#747 ⌘Z
fires the waiting Undo toast; #749 ⌘Enter commits every Save dialog). The review round earned
its keep on the seams that speed built: six findings, five of them the same lesson from
different angles — **a state derivation is only as good as its round-trips** (chip toggles,
the Focus exit, the bookmark star, and the dial itself all leaked the forced Next-only until
#751 sealed them, with the F4 design call made explicitly: both doors to a bookmark now deal
the same deck). Codex: third consecutive clean pass — the lifecycle lens keeps coming back
dry while the logic-flow lens keeps finding real ones. Verdict: **converged** — the bookmark
ecosystem (name it, view it, deal it, from either device) feels complete; next up, per the
user: "serious development ideas" awaiting discussion.

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
