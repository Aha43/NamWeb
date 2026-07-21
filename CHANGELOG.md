# Changelog

All notable changes to NamWeb are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). Pre-1.0 (`0.MINOR.PATCH`):
minor = features (breaking changes allowed), patch = fixes.

## [Unreleased]

## [1.12.1] - 2026-07-21

**Shared counters keep an honest count under concurrent editing.** The behind-the-scenes machinery
that folds guests' ticks and answers into your workspace is now safe when two of your devices are
open at once (or a drain is interrupted) — the 2.0.0 blocker for real multi-device sharing.

### Fixed

- Concurrent or interrupted drains of a shared resource can no longer lose or mis-apply a guest's
  tick or answer. A per-share drain lease serializes draining across your devices (so events apply
  in one global order), each event is folded in exactly once via a per-resource idempotency
  watermark recorded atomically with the value, and the drain deletes an event only after its
  landing is durably confirmed — so two devices, a lost network call, or a closed tab re-process
  safely instead of dropping or reordering the change. Closes #850, #852.

## [1.12.0] - 2026-07-20

**The backend learns to clean up after a departed user.** Deleting an account (or, now, an
admin deleting a user via the new **NamAdmin** tool) removes the owner's workspace through a
database foreign-key cascade — the same mechanism shared projects already use — instead of
failing on the constraint. A small, foundational change that unblocks NamAdmin, the local-only
admin surface for NamWeb's users.

### Changed

- Deleting an account now removes the workspace through the database's foreign-key cascade
  (matching how shared projects already clean up), so account and admin-side user deletion
  work reliably; `delete_my_account` is simplified to rely on the single cascade mechanism.
  Closes #847.

## [1.11.0] - 2026-07-19

**System tags grow up.** The built-in tags that shape sharing and focus — long indistinguishable
from your own vocabulary — move into a reserved `#` namespace (`#in-progress`, `#shared-hide`)
that reads clearly as system and can't be collided with. `private` becomes `#shared-hide` (and
the plain word `private` is yours again). Two new share-shaping tags ride the namespace:
`#shared-show` pins an item onto a shared page past "Hide completed", and `#shared-open` opens a
section expanded on arrival. A two-round dual review hardened the reservation to be
idempotent and non-destructive — your tags are never rewritten or lost.

### Fixed

- A `#`-prefixed tag that isn't a real system tag is no longer treated as one — it stays an
  ordinary tag (not bold, not protected) and is never deleted or rewritten. Only the built-in
  system tags behave specially, so tag edits stay predictable and consistent. Closes #842, #844.

### Added

- Two more share-shaping tags: `#shared-show` pins an item onto the guest page even when "Hide
  completed" would drop it (great for "we already got the axes"), and `#shared-open` makes a
  section open expanded on arrival instead of folded. Closes #838.

### Changed

- System tags now live in a reserved `#` namespace — "in progress" becomes `#in-progress` and
  the share-hide tag is `#shared-hide` (renamed from `private`, which is now a free tag again).
  You can still apply system tags from the suggestions, but can no longer accidentally create a
  colliding one, and they read clearly as system rather than your own vocabulary. Existing
  `in progress` tags keep working. Closes #837.

## [1.10.0] - 2026-07-18

**A second thing to ask, and a tidier front door.** Shared projects gain the **Question**
resource — a tri-state yes/no that family answers straight from the shared page ("bringing a
tent?"), flowing home through the same guest-append / owner-drain pipe the counters use;
tap the active answer to un-decide. And guest pages now open with every section collapsed, so
the table of contents is the front door and visitors open straight to what they came for. A
dual review hardened the drain's write path behind owner-scoped RPCs (an old client now fails
closed rather than eating guest input) and split the guest overlays so simultaneous shoppers
don't clobber each other.

### Fixed

- Draining guest events now happens through owner-scoped server functions, and direct writes
  to the events table are revoked — an owner tab running an older app version can no longer
  claim-and-delete guest input it doesn't understand; it simply can't touch it. Closes #832.
- A guest page open in a pocketed phone no longer discards another shopper's fresh answer just
  because you ticked a counter (and vice versa) — the two live overlays refresh independently.
  Closes #832.
- Switching a resource's type to Question in the editor now moves the cursor to the question
  field. Closes #832.

### Fixed

- The guest-event drain only claims event kinds it can apply — an owner client running an
  older bundle (or, later, a newer event type) no longer claims-and-deletes guest input it
  can't yet handle; unknown events wait for a client that understands them. Closes #830.
- Switching a counter with "completes at the goal" to another resource type no longer leaves
  the invisible flag stranded on it. Closes #830.

### Added

- A new resource type: the yes/no **Question** — a tri-state (unanswered / yes / no) you
  answer with a tap, tapping the active answer to clear it. Like counters, a question can be
  delegated to guests: publish it and family answers "bringing a tent?" straight from the
  shared page, flowing home through the same drain. Closes #827.
### Changed

- Shared pages open with every section collapsed — the table of contents is the front door,
  so guests land on the index and open straight to what they came for (deep links still
  arrive with their target unfolded). Closes #826.

## [1.9.0] - 2026-07-17

**Guests keep the count.** Shared pages stop being read-only: the owner delegates a counter
("you keep the jar count") and family ticks it from the store — events flow through a
guest-append / owner-drain pipe that leaves the single-writer model untouched. Counters can
complete their action at the goal and reopen when stock depletes; a "Hide completed" toggle
turns a share into a proper shopping list; and got-enough items strike through in the aisle,
live. Hardened by a dual review before the cut — durable-before-delete draining, remembered
publish options, crossing-not-threshold completion.

### Fixed

- Guest ticks are deleted only after their workspace writes durably confirm — a crash,
  logout, or failed push between drain and save can no longer lose them; dead leftover rows
  from old sessions are swept so no cap ever ratchets; and the "new guest ticks" line counts
  only the open queue. Closes #823.
- A share published with "Hide completed" re-seeds the dialog from how it was published — no
  phantom dirty hint, and a routine republish no longer silently re-exposes hidden items
  (the snapshot now remembers its publish options). Closes #823.
- The guest overlay's refresh is generation-guarded — an older response can no longer rewind
  a just-accepted tick or a fresher refresh — and the event/suggestion caps are enforced
  atomically per share (concurrent inserts on a leaked token can't race past the bounds).
  Closes #823.
- The counter-completion checkbox speaks in crossings: "Ticking to the goal completes the
  action (ticking below reopens it)". Closes #823.

### Fixed

- Counter completion now fires on boundary CROSSINGS, not thresholds — a guest tick in the
  overshoot zone no longer re-completes an action the owner deliberately reopened, and a
  decrement below target no longer reopens a hand-completed one. Closes #821.
- The guest-tick drain resolves its plan against the live document after claiming events — a
  sync refetch landing mid-drain can no longer strand claimed ticks — and landed events are
  now deleted, so the lifetime cap can never ratchet a share deaf. Closes #821.
- The guest page re-pulls other shoppers' ticks when the tab regains focus (two family
  members no longer both buy the milk), and the share dialog counts what a republish would
  reveal ("N items guests can't see yet"). Closes #821.

### Added

- A "Hide completed" toggle on shares: the trip page keeps showing progress, the shopping
  list drops what you've got enough of — per share, defaulting to today's behavior. And on
  the guest page, an item whose delegated counters have all met their goals reads as done in
  the aisle, live via the overlay — no republish needed. Closes #817.
- A counter can complete its action: tick "Completes the action at the goal" and the tick
  that lands the count at the target marks the action done — and the tick that drops it back
  below reopens it (the stock loop: done while stocked, alive when depleted). Ticks only —
  hand edits in the dialog never transition — and guest ticks complete at home through the
  ordinary drain. Closes #816.

- Guest ticks land in the workspace: the owner's client drains delegated-counter events on
  app open and on opening the share dialog — each tick applies exactly like the owner's own
  tap (same clamping, same guards; two devices draining concurrently split the batch instead
  of double-counting), and the share dialog shows a "ticks from guests" provenance line.
  Closes #811.
- Delegated counters are live on guest pages: a counter marked "guests can update" renders as
  the interactive pill on the shared page — ticks flow through the event pipe, the page shows
  the published count plus everyone's undrained ticks, and a refused tap quietly doesn't move.
  Closes #810.
- Guest-interactive resources, the infrastructure (dark): a counter can be marked "Guests can
  update this on shared pages" — the flag rides the snapshot, and a new events table + RPC
  pair (append a tick / read the undrained overlay) lands the pipe's plumbing. Nothing
  user-visible changes yet; the guest pill and the owner drain follow. Closes #809.

## [1.8.0] - 2026-07-16

**The guest loop closes, and resources learn to count.** Shared projects (still Labs-dark)
became real guest pages this cycle: a table of contents up front, collapsible sections, and a
suggestion box — a guest reads, folds, and suggests; the owner adopts straight into the inbox
with provenance. And the resource family grew its registry plus its first interactive member:
counters you tick from the list, both directions, with an unlimited "goal, not a cap" mode
for recording overshoot. A dual review hardened both fronts before this cut.

### Fixed

- The share dialog's From-guests tray resets with the rest of the dialog state — a previous
  project's suggestions no longer greet a new share while it loads, unpublish empties the
  tray with the rows it cascades away, and a slow tray fetch can no longer land after the
  dialog closed. Closes #804.
- The share suggestion cap no longer counts handled rows — adopting or dismissing frees
  space, so a tended tray never goes permanently deaf (a lifetime backstop still stops true
  abuse), and the owner dialog warns when the tray nears the cap. Closes #802.
- Un-ticking "goal, not a cap" on an overshot counter now warns before Save clamps the
  recorded count, instead of silently destroying overshoot. Closes #802.
- Counter pills dispatch the stored value as their stale guard instead of reconstructing it —
  a non-canonical value ("03/10") from an import or hand edit no longer makes a permanently
  dead pill — and the pill's −/+ get touch-target padding, staying rendered (disabled) at the
  edges instead of vanishing under a mid-burst finger. Closes #802.

### Added

- Counters can be marked "Goal, not a cap" (unlimited): the target stays a goal — the pill
  still turns green at it — but + keeps counting past it, recording overshoot ("14/12").
  Packed as a trailing `+` on the machine value, so old readers stay legible and existing
  counters are untouched. Closes #800.

- **Counter resources.** A new resource type: give an action a counter ("boxes to the attic · 0/12") and tick it right from the list — **both ways**: + counts up toward the target, − counts back down (track a variable stock: use from it, re-supply to it), each edge quietly losing its button. Saves immediately, no editor, no Save; green at the target (it signals; finishing the action stays your call). Behind it, resource types moved onto a small registry — the next type is a one-entry job — and the types finally wear names instead of shouting URI/FILE at you. Closes #798.

### Added

- **Project sharing, stage 4: the suggestion box.** The 2.0.0 loop closes: a shared page now ends with a small "Suggest something" box — optional name, an idea, one visible Send — and suggestions land in the owner's Share dialog as a **From guests** tray, where **To inbox** turns one into a normal capture (provenance in the note: who, when, via the shared page) and Dismiss retires it. Guests capture; you clarify — nobody edits anything of yours. Behind the scenes: suggestions hang off a rotation-proof share id, the table is invisible to guests (write-only through a guarded door: 2000-character ideas, 500 per share, dead links accept nothing), and everything already published grows the box on deploy. Closes #796.

### Added

- **Guest page sections fold.** Every section heading on a shared page is now a disclosure — tap to collapse, tap to reopen — defaulting fully expanded so the page reads exactly as before until a guest chooses focus. Collapsed headers stay honest (date span + "N inside"), and anchors see through the folds: a Contents tap or a deep link expands whatever hides its target. Existing links upgrade on deploy, as always with renderer iterations. Closes #794.

### Added

- **Guest pages lead with a table of contents.** A shared project with sections now opens with a small Contents block — section titles and their date spans, each a jump link — so a guest lands oriented instead of scrolling blind. Always on (it's small and familiar); collapsible sections are the next lab iteration. Every already-published link gets it without a republish. Closes #792.

### Fixed

- **The version found a home on the phone.** The version + build stamp lived in a hover tooltip (touch has no hover) and the Help page footer (found by nobody) — it now sits in the More sheet's footer, where mobile users actually look. Closes #790.

## [1.7.0] - 2026-07-14

**NAM learns to live in your hand.** The phone arc: an audit found rows spending half their
width on desktop furniture, and a real day of thumb-driven dogfooding found the rest — titles
now read in full behind a quiet per-row "…", list headers fold into a Filter chip that never
lies about what it hides, the inbox glows red from the bottom bar until you process it, the
keyboard's checkmark finally saves your edits, and the big + capture button actually captures.
Hardened by both reviewers: a coin-toss e2e caught red-handed, a blur-reflow dead tap frozen
solid, and an empty state that had learned to lie taught honesty.

### Fixed

- **The phone disclosures introduce themselves properly.** The row "…", the inbox "…", and the Filter chip now carry `aria-controls` linking each trigger to the strip it opens (Codex review P3) — fixed while the pattern is young and before it gets copied further. Closes #788-round (rides #786's hardening arc).

### Fixed

- **Review hardenings (independent Claude review).** The phone reveal e2e was green only by losing a race (it probed the always-visible Edit button) — it now awaits the row and probes a real strip control; the pencil and inbox "…" stay rendered (disabled) during a rename so the tap that ends an edit can't die on shifted ground; the phone Filter chip wears a dot when the boxes differ from the view's defaults, and an all-filtered list now says "N hidden by the status filter" instead of a cheerful (lying) all-clear; the capture input refocuses after a phone Add-button tap so rapid capture keeps its rhythm; an open "…" strip no longer survives into select mode; and the inline editor re-arms on focus so its fresh-mount contract is no longer load-bearing. Closes #786.

### Fixed

- **The big + saves again on the phone.** The capture sheet had no submit button (removed in #626, trusting Enter/Go) — but some phone keyboards show a ✓ that never fires Enter, making capture a dead end. The phone gets its Add button back (desktop stays buttonless — Enter is a real key there), and the input now asks the keyboard for a Go key. Closes #784.

### Fixed

- **The phone keyboard's checkmark now saves an inline edit.** Renaming an inbox item (or anything using the inline editor) committed on Enter but *cancelled* on blur — and the mobile keyboard's ✓ dismisses the keyboard, which blurs: every phone edit silently vanished. Blur now commits; Escape remains the deliberate cancel. The inbox rows also join the phone "…" pattern — title, age, and **Process** stay out; copy/rename/delete reveal on demand. Closes #782.

### Added

- **The inbox cue reaches the phone.** The bottom-bar Inbox glows red with a count while captures wait, green when you're clear — same signal as the desktop sidebar, now where the couch question actually gets asked. Closes #778.

### Changed

- **Phone rows breathe.** On the phone, the seven-icon control strip no longer squats on every row — a single "…" reveals it on its own full-width line when you need it, and titles get their width back (no more "Refill medicati…"). The tag/date line follows onto one line. Desktop rows are untouched. Closes #776.
- **Phone list headers grew up.** The desktop furniture — status boxes, the rows toggle, Sort — no longer crams and wraps at phone width: one quiet **Filter** chip discloses it all, stacked and thumb-sized, while Focus stays out beside the chip where a primary action belongs. Desktop headers unchanged. Closes #777.

## [1.6.0] - 2026-07-13

**Standing alone, sharing quietly.** The cut where NamWeb became self-contained — Supabase
config and migrations moved home, the docs stopped calling this the companion — and the 2.0.0
engine came aboard dark: projects can publish to secret guest web pages (Labs), the sanitizer
adversarially reviewed, the security model proven against production. Around it, a dogfooding
sprint made the everyday lists sharper: the inbox glows red until you process it, rows go
compact on one flip, status boxes turn every list into exactly the view you need, and the
calendar stopped living twice. Hardened by the fullest review dance yet — seven findings
across two rounds, including a real private-date leak and a dirty-hint bug only the production
database could reveal.

### Fixed

- **Review hardenings (independent Claude review).** The sharing sanitizer no longer lets a private child's dates shape a derived section span (the one construction that got through — min/max of one item is that item's value); the Share dialog's changes-since-publish hint now sees through Postgres's key reordering instead of being permanently on; a stale republish can no longer resurrect a rotated (revoked-for-security) link, and a raced rotation fails loudly instead of showing a link that never existed; the Contexts status boxes forget their session tweaks when a saved view or bookmark re-click lands a fresh visit; corrupt documents publish what they can instead of crashing; and a future share format tells guests they need a newer link rather than rendering wrong. Closes #772.

### Added

- **The inbox is in your face now.** The sidebar Inbox entry glows red with a count badge while anything sits unprocessed — and a happy green when you're clear. Backlog, Due, and Done carry their counts quietly in their tooltips (and in dense mode the inbox count joins its tooltip too), easy to inspect without stealing the inbox's light. Closes #764.
- **Compact rows, one flip away.** Action lists keep today's rich look by default, but a small toggle in every list header (beside Focus/Sort) switches to compact rows — name and controls only, tighter padding, real height back on long lists. Device-level: flip it once, every list follows; flip it back when you want the tags and dates under each action again. Closes #765.
- **Status boxes on every list.** Next, Backlog, Due, the Contexts views, and the project workbench's action list each carry three include-checkboxes — Next / Backlog / Done — so any list can show more (tick Done on Next to see finished work inline; tick Done on Due for the satisfying what-was-due-and-got-done view) or less (untick Done on a workbench). Defaults keep every view exactly as it was; the choice is session-local — nothing about bookmarks or saved views changes shape. The Done view deliberately sits this one out: its row controls are done-specific, and "done alongside" is what the other views' Done box is for. Closes #766.
- **Project sharing, stage 2: the guest page.** The secret link now renders — a clean, mobile-first itinerary page with the project as the masthead (dates and notes included per the share's toggles), sub-projects as sections, and items with friendly dates in the guest's own language. No sign-in wall, no app chrome, no NAM concepts — just the trip, with a quiet "Shared from NAM" footer. Unknown, revoked, and failed all land on the same gentle "no longer active" page (no way to probe for links), and search engines are told to stay out twice over. Closes #761.
- **Project sharing, stage 1 (dark, Labs).** The 2.0.0 epic's foundation is in: a `project_shares` table whose only guest read path is a locked-down RPC (no way to enumerate links), a pure allowlist sanitizer that snapshots a project for guests — `private`-tagged subtrees stay home, cancelled/archived never travel, field toggles choose dates/progress/notes, and guest ids reveal nothing — and a Share dialog on the workbench (behind the new **Labs** settings toggle, real accounts only): publish mints the secret link, republish refreshes it, unpublish/new-link kill the old one. The guest page itself is stage 2 — the link 404s for now. Closes #759.
- **Project sharing has a design doc.** The 2.0.0 epic — projects published as guest-friendly web sites via secret links, guests never becoming users — is written up in `docs/features/project-sharing/design.md`: the snapshot architecture, the `private`-tag visibility grammar, capture-not-edit guest input, the staged (dark) rollout, and the open questions each stage must settle. Closes #757.

### Changed

- **Calendar lives in the toolbar only.** The left sidebar's duplicate entry is gone on desktop — the command-bar icon is the one home (the phone More sheet keeps its entry; there's no toolbar there). Closes #763.
- **The Supabase setup moved home.** Config and the full migration history now live in this repo (`supabase/`), with `npm run db:start/stop/status/reset` wrappers — the first stone on the road to 2.0's sharing schema, and a consequence of parking NamDesktop. Migration files are verbatim (prod history parity); the real-Supabase smoke spec was de-drifted and runs green against the stack from its new home. Closes #753.
- **The docs tell the truth: NamWeb is NAM.** CLAUDE.md and the README no longer describe this repo as the "web companion" — NamWeb is the primary (and only active) surface; NamDesktop is parked as the valuable phase one, with a future desktop to be redone from both codebases' lessons. The workspace document format stays a spec-in-progress (additive-only discipline kept). Closes #754.

## [1.5.0] - 2026-07-12

**Rituals, one click away.** Bookmarks grew from shortcuts into the app's control surface: a
Focus ▾ speed dial deals any bookmark as a deck (on the phone too — the couch is where rituals
happen), and opening a context bookmark now lands on its own view — your name on it, the
workshop tucked away, Next-only on because you came to do. Around it, the keyboard caught up:
⌘Z fires the waiting Undo toast, ⌘Enter commits every Save dialog. Hardened by the dual-review
dance — six Claude findings closed the view's round-trip seams and made the dial and the view
mean the same thing; Codex's third consecutive clean pass.

### Fixed

- **Review hardenings (independent Claude review).** The bookmark view's forced Next-only now survives everything a visit does: tag-chip toggles no longer silently release it, the Focus round-trip comes home to the bookmark view instead of the Tags workshop, and the bookmark star stays filled inside the bookmark's own view (no accidental near-duplicates). The speed dial follows the view's rule — a context bookmark's deck deals Next-only and its exit lands back in the bookmark view. Plus: ⌘Z can't fire an undo invisibly under an open menu, the new ⌘-Enter handlers respect IME composition, and the tag chips can't get stuck hidden if a bookmark vanishes mid-visit. Closes #750.

### Added

- **Undo answers ⌘/Ctrl+Z.** While an Undo toast is up, the universal undo key fires it — no mouse travel to a small button at the bottom of the screen. Text fields keep their own undo, modals keep their keys, and the toast's button now shows the key hint so the shortcut teaches itself. Closes #744.

- **The Focus speed dial.** The command bar's Focus entry became a split-button like its neighbors: the ▾ chevron lists all your bookmarks, and clicking one deals the deck scoped to it — a project bookmark focuses its open actions (the workbench Focus, minus the walk), a context bookmark focuses its tag filter. Your rituals, one click from anywhere: tune a context once, name it ("After work"), speed-dial into it daily. The plain Focus click keeps meaning what it always did. Closes #738.
- **The speed dial reaches the couch.** On the phone, each More-sheet bookmark row carries a small target glyph beside its label: tap the label to open the view (as always), tap the target to deal the Focus deck scoped to that bookmark — the sheet closes and the first card is up. Closes #739.

### Changed

- **A context bookmark lands on its own view, not the Tags workshop.** Opening a bookmarked context now leads with what you came for — the actions — under the bookmark's (custom) name as the title. Tag management and saved views stay in the plain Tags view; the tag selection collapses to one dense line that expands when you want to tweak what belongs in the ritual. Next-only sits outside the collapse — the doing-lever stays at hand — and lands **checked** by default (unchecking sticks for the visit). Tweaks are session-local — the bookmark itself is never silently rewritten. Closes #745.

### Fixed

- **⌘/Ctrl+Enter commits every Save dialog.** The app-wide "commit this dialog" gesture (action editor, summary copy-&-close, picker pick) now also works in the two dialogs that missed it: bookmark rename and resource create/edit. Guards intact — an empty name or value still refuses. Closes #746.

## [1.4.0] - 2026-07-11

**Small dials, daily surfaces.** Three one-and-two-issue sprints straight from holiday
dogfooding, each closing a friction the heaviest-used features had grown: prerequisites are
picked in the column browser instead of an unusable flat select, the exported summary can be
edited in place before copying (Regenerate as the undo, a guard so a stray Escape can't eat
your words), bookmarks take custom names with the technical truth on hover, and dense mode
sheds one more word. Hardened by the dual-review dance — three Claude findings (one a genuine
capability gap: a dead-end picker), then a second consecutive fully clean Codex pass.

### Fixed

- **Review hardenings (independent Claude review).** The prerequisite picker's candidate list now agrees exactly with what its columns can browse — no more dead-end picker (an "Add a prerequisite…" button whose targets were all unreachable), and inbox captures are deliberately out of the candidate set: clarify first, then block. Closing the summary dialog with edited-but-uncopied Markdown now asks before discarding (Regenerate stays the deliberate in-dialog undo; ⌘-Enter copy-&-close never asks — the copy is what makes it safe). Plus a dead locale key swept. Closes #735.

### Added

- **Bookmark labels grow up.** A bookmark's name is now yours: a pencil in the bookmark menus opens a rename dialog (prefilled; project bookmarks get a one-click "Use project name"; empty names can't save — duplicates are your call). So the third "Next sprint" bookmark can become "Next sprint (NamWeb)", and a tag pair like `economy` + `summer-trip-26` can read "Economy of trip to Japan". Hover a row for the technical truth underneath: the full project path, or the tag list (+ Next only). Closes #732.
- **Edit the summary before you copy it.** The project summary dialog grew an Edit toggle: tweak the generated Markdown in place — a remark for the reader, a one-off note that doesn't belong in the project — and Copy/⌘-Enter take your version. Regenerate discards the edits and returns to the live generated text (the include-filters lock while a draft exists, so a filter flip can't silently clobber your words). Real content still belongs in the project as actions; this is for the small stuff. Closes #729.

### Changed

- **Dense mode trims the Summary button to its icon.** The document icon is descriptive on its own and the tooltip still names it (and the `s` shortcut) — one less word on the dense workbench header. Closes #731.
- **Picking a prerequisite browses, not scrolls.** The editor's "Blocked by" section adds a prerequisite through the same column-style action browser used for linking and moving — instead of the old flat select listing every action in the workspace, which was nearly unusable with real data. Same valid-target rules (no cycles, no projects); the ⌘-Enter save politely waits while the browser is open. Closes #727.

## [1.3.0] - 2026-07-10

**The editor slims down.** Two dogfooding sprints in one cut: web links became first-class
(display names, real click-to-open), *in progress* learned to end when the action does, and then
the editor's two bulkiest blocks went dense — resources as clean display rows with dialog editing,
due controls collapsed to a one-line hint until asked for. Hardened by the dual-review dance: six
Claude findings (including a portal-bubbling bug fixed at its source), and the first fully clean
Codex pass.

### Changed

- **Resources are rows, not forms.** The always-visible add-form under the resources list is gone: rows show each resource doing its job (a named link linking, a note reading) with a "…" on the left opening a small type-appropriate dialog — which also means resources are finally *editable* (fixing a URL typo no longer takes delete + re-add). One "Add resource…" button creates via the same dialog; "Link action…" is unchanged. The editor's ⌘-Enter save now politely waits while any of these nested dialogs is open. Closes #720.
- **Due controls are dense until asked for.** In the action editor and the project Details panel, the four-input due block collapses to the set time shown as the same compact hint rows use (range, times, derived edges italic) with a small edit affordance — or a "＋ Add due date" opener when nothing is set. Expanding reveals the familiar full controls (a ⌃ beside Clear collapses back); nothing about how due dates save has changed. Closes #721.

### Added

- **Web links grew up.** A URL resource can carry a display name — stored in the resource's existing (never-used) description field, so the value stays a pure URL and nothing new syncs. Rows show the name when set, hovering reveals the underlying URL either way, and clicking an http(s) resource opens it in the browser like the normal link it is (new tab). Closes #715.

### Fixed

- **Review hardenings (independent Claude review).** Pressing Enter in the move picker's "New project" prompt no longer saves and closes the whole editor underneath it (the same portal-bubbling bug as the resource dialog's, now fixed at the source in the shared prompt control); a due block collapsed over invalid text auto-expands when Save flags it, so the error is never invisible; Undo of an accidental Done now restores the *in progress* mark the terminal strip removed; editing a non-URL resource no longer wipes its (possibly desktop-written) description; the tag field can no longer re-attach *in progress* to a finished item; and a deriving project's collapsed due line in the editor shows its effective span like the Details panel does. Closes #724.
- **Inbox tooltips.** The Process inbox / Process selected button (the glowing target) now explains itself on hover, and both "Process…" wizard-openers (inbox select mode and the capture dialog) hint what clarifying together means. Closes #714.
- **In progress ends when the action does.** Marking an action Done (or Cancelled) now sheds the built-in *in progress* tag — by any path: status menu, bulk ops, the Focus deck — and finished rows no longer offer the working-on-it toggle. Restoring an action doesn't resurrect the tag. Closes #716.

## [1.2.0] - 2026-07-09

**Projects tell time.** One arc, start to finish: projects got the action editor's full due
controls, their dates became visible on rows, they took their place on the calendar — and then
learned to *derive* their span from their contents, opt-in per project, explicit dates winning
per edge, so a holiday starts when you leave the house and ends whenever the last booking says.
Nothing derived is ever written. Hardened by the full dual-review dance — six findings, zero
overlap, including one clobber bug the two reviewers closed from opposite ends.

### Fixed

- **Review hardenings (Codex review).** The due editor now writes only what you actually edited: untouched inputs commit nothing on blur, and pristine drafts follow changes syncing in from another device (an active edit still wins — the app's existing conflict model), closing the last path where stale dates could overwrite fresh ones. The derive-from-contents toggle also survives a workspace import, and converting a project to an action sheds it. Closes #711.
- **Review hardenings (independent Claude review).** A project's due dates now persist only when *they* are edited — previously, with the Details panel open across a sync from another device, blurring any other field could write the panel's stale due values back over the fresh ones. Derived time also got a non-hover voice: the italic hint carries screen-reader text and the ghost due inputs a "Derived from contents" hover title. The inverse holiday (typed end, derived start) is deliberately deferred to #708. Closes #709.

### Added

- **Projects tell time like actions do.** The workbench Details panel grew the action editor's full due controls — date range and times behind the same "＋ Add time or a range" expander — instead of a lone due date; same parsing, same validation, autosaved on blur. First step of the projects×time arc. Closes #699.
- **Project rows tell time.** The Projects list and the workbench's sub-project rows now carry the same urgency-toned due hint action rows have (range- and time-aware, honoring the date-format setting) — a dated project is visible where you browse, not only inside its Details panel. Closes #700.
- **Projects on the calendar.** A dated project marks every day of its span with a small folder badge — separate from the action count, which keeps meaning exactly "N actions due" (and a project alone never paints a past day with the overdue warning). Hover a day and the tooltip names its projects after its actions; drill in and a Projects section sits under the day's action list, each row opening its workbench. Creating projects stays on the Projects surface — the day's New action button is unchanged. Closes #703.
- **Projects can derive their time from their contents.** Opt-in per project ("Derive from contents" in the Details panel): the span follows the subtree's dated items — sub-projects composing upward, done items still counting (a booked flight marks the trip even after "book flights" is ticked) — while any typed date wins its edge, so a holiday can start before its first flight and keep an end that breathes as bookings land. Derived edges show as ghost placeholders in the editor and italic (with a hover hint) on rows and the calendar; nothing derived is ever written or synced. Closes #706.

## [1.1.0] - 2026-07-08

**The calendar era opens.** A real month view grew in two days from grid to daily driver — drill
into a day, plan one straight from it, week numbers in the gutter, titles on hover — alongside a
dogfooding-driven polish pass on the everyday surfaces (the Focus entry stopped scrolling away,
loose actions learned to file themselves into projects, the template tools stopped hogging the
sub-projects section). Cut through the full dual-review dance: six findings, two reviewers, zero
overlap — all fixed in-range, one new CI gate.

### Changed

- **"Save as template…" moved up to the project header.** It sits as a quiet icon beside Summary — a project-level, rarely-used operation shouldn't wedge itself between the add-sub-project box and the list. New sub-projects now appear directly under where you typed; the "Add from template…" picker stays in the Sub-projects section, below the list. Closes #686.

### Fixed

- **Review hardenings (Codex review).** Hand-mangled calendar URLs (`?d=2026-99-99`, `?m=2026-99`, February 31) now fall back to the grid / today's month instead of crashing the route or silently rolling into the next month; the calendar e2e journey no longer fails when run on the first of a month; the shared en/nb domain vocabulary was regenerated for `domain.calendar` and `i18n:check` joined the per-PR CI gate so vocab drift can't land again. Closes #696.
- **Review hardenings (independent Claude review).** Free actions — the ones you'd most want to file into a project — now get the move-to-project menu in Next/Backlog (top-level projects as quick destinations; on desktop the folder icon always offers "Browse all projects…", even with no projects yet). The Due view no longer lists CANCELLED actions, agreeing with the calendar. The "Add from template…" picker hides while the Sub-projects section is collapsed instead of applying into an invisible list. Closes #694.
- **The Focus button no longer scrolls away.** On Next, Backlog, Due, and Done the green Focus target now lives in the frozen header row (Due and Done gained one — Done's pins its select tools too), so the entry into Focus stays reachable however long the list. Closes #687.
- **Tooltips everywhere they were missing.** The project/context bookmark ▾ triggers now hint on hover, and every copy icon carries its tooltip (Focus deck, project rows, resources, and the editor/details title+description copies). Closes #679.

### Added

- **Week numbers in the calendar.** Each week row carries its ISO week number in a blue left gutter — hover says "Week N" for anyone wondering. Closes #680.
- **Create an action straight from a calendar day.** The day list's New action button opens the normal editor with the due date prefilled to that day (noon) — a great way to plan a day from the calendar; edit the date away if you realized something else. Closes #681.
- **The global calendar.** A new Calendar surface (toolbar button and Views navigation) showing the classic current-month grid: Monday-start weeks, today ringed, each day summarizing its open dated work — a count, range actions lighting every day they span, and a warning tint on past days with unfinished actions. Navigate with « ‹ Today › » (the shown month lives in the URL). Built as a thin shell around interchangeable calendar views — the month grid is the first. Closes #675.
- **Click a day to see its work.** A day box swaps the calendar for that day's action list — the standard rows (edit, delete, the works) — with a Calendar back button (and browser back) returning to the same month; empty days say so. Closes #676.
- **Move an action into a project straight from Next and Backlog.** The workbench's folder icon now sits on rows in the two triage views too — proximate destinations in the quick menu, "Browse all projects…" (with New project here) behind it; the inline dropdown on phone. Closes #688.
- **Hover a calendar day to see what's on it.** Day boxes with work now tooltip the titles of that day's actions (up to five, then "+N more") — a peek without the drill-in. Closes #689.

## [1.0.0] - 2026-07-07

**NamWeb 1.0.** What began as a deliberately small web companion to NamDesktop — "add a thought,
check what's next, tick something done" — grew, sprint by dogfooded sprint, into a complete GTD
surface in its own right: capture anywhere (with a streak-friendly dialog that resizes and
remembers), one wizard-shaped clarify model across the app, a process deck that cycles until the
inbox is truly empty, Focus mode, due dates and ranges, tags with contexts and the built-in
**in progress** system tag, bookmarks that reorder and self-clean, a Finder-style browser that
opens projects *and* actions — and cards that link to cards. Under it: real accounts (sign-up,
verify, reset, export, delete), optimistic sync with conflict-retry and realtime reconcile over
the workspace document shared with NamDesktop (every change additive, never breaking), full
English + Norwegian, a no-account demo, and a quality culture that grew with the code — per-PR
gates, ~700 unit tests, >100 end-to-end journeys, and a pre-release ritual of **two independent
AI reviews** whose findings have never once overlapped. 1.0 stamps the foundation, not a feature:
the calendar era (1.x) builds on it next, and AI working the app over MCP is the 2.0 horizon.

### Fixed

- **Pre-1.0 review follow-ups.** Repaired merge-conflict markers that had slipped into this very file (and added a test that fails on markers in any markdown, so they can never reach release notes); the phone More-sheet tap guard now tracks the sheet's actual slide (not a stopwatch) and suppresses only pointer taps in the tab-bar zone — the close ✕ and keyboard activation always work (Closes #671, #673).
- **No more surprise jumps to Account/Settings on the phone.** Root-caused at last: the More sheet slides up under the finger that just tapped More, so a quick second tap landed on whichever row passed that spot and navigated. The sheet now ignores taps in its first moments after opening. Closes #412.
- **Hover tooltips are back on inbox row actions.** The per-item copy, rename, Process and delete controls show their hint on hover again (the aria-labels were always there; the tooltips had gone missing). Closes #543.

### Added

- **Release-footprint archive.** The "footprint since last release" paragraph reported at every cut is now filed verbatim in `docs/footprints.md` (newest first) for historical analysis — themes over time, converging-vs-polishing calls, process experiments. Seeded with v0.9.0/v0.9.1/v0.10.0; the RELEASING ritual now includes the append. Closes #667.

## [0.10.0] - 2026-07-06

Cards link to cards. The Finder-style browser learns to select actions as well as project folders
— the toolbar explorer now opens either — and on that foundation an action can carry a link to
another: stored as a `nam://action/<id>` resource on the shared document (NamDesktop-safe), shown
as the target's live path, one click to follow. Link in either direction ("Link action…" /
"Link another action here…") and a toast offers the reverse. The cut was hardened by a
two-reviewer experiment — an independent Claude review and a Codex review with zero overlap
between their findings, all six fixed.

### Fixed

- **Linked-cards hardening (review follow-ups).** The "Link back" toast now re-reads the target when clicked (a stale snapshot could clobber edits made in the meantime — and routes into the target's editor buffer when that editor is open); linking the same card twice collapses to one link; and following a link saves your open edits before switching cards instead of silently discarding them (Closes #663). A Codex pass added: both link endpoints are revalidated when "Link back" fires (a deleted card can no longer receive or produce a dangling link), and the resources toolbar wraps on phone widths instead of overflowing. Closes #665.

### Added

- **Linking flows: "link to here" and the double-link offer.** With a card open, **Link another action here…** picks a card that should point at this one — the link is created on the picked card instantly. And whichever direction a link is made, a toast offers **Link back** to create the reverse in one click. Closes #659.
- **Linked cards.** An action can link to another: in the editor's Resources, **Link action…** opens the browser (actions as files) — the link is stored as a `nam://action/<id>` URI resource (NamDesktop sees an ordinary URI), shown as the target's live path. Click it to jump into the linked action, "…" to re-pick, ✕ to unlink; a deleted target shows as gone. Links survive workspace import (ids are remapped). Closes #658.

### Changed

- **The explorer opens actions too.** The Finder-style browser now lists actions as files alongside project folders (with folder/file icons; done and archived work stays hidden) — Open a project to land in its workbench, Open an action to jump straight into its editor. Move/file pickers are unchanged (folders only, as before). Closes #657.

## [0.9.1] - 2026-07-06

Clarify-flow polish: the "Process inbox" deck cycles through skipped items and can walk just your
selection; the new built-in **in progress** tag marks what you're actually on (orthogonal to
status, one click from any row or the Focus card); and two hardenings land underneath — the
removed-items flicker is gone (a display rewind in the sync core), and system tags survive
NamDesktop's casing.

### Added

- **"in progress" — a built-in system tag.** Mark what you're actually working on, orthogonal to status (a Backlog item you've started but are waiting on is legitimately both). One-click toggle on action rows and the Focus card; always offered in tag suggestions and filters; shown bold everywhere; protected from rename/delete. Syncs to NamDesktop as a plain tag. Closes #651.

### Fixed

- **System tags survive NamDesktop casing.** A document carrying "In Progress" written by the desktop app is now handled case-insensitively: the working-on-it toggle reads and clears it, the tag lists show one spelling, and the built-in filter finds it. Closes #654.
- **No more removed-items flicker.** Bulk operations (the wizard's Done, bulk delete, the process deck) removed items, briefly showed them again, then removed them for good — each per-item save was rewinding the display past the still-pending ones. The display now adopts only the final state of a burst; the data was always correct. Closes #650.

### Changed

- **The "Process inbox" deck cycles and honors the selection.** Skip no longer discards an item for the run — it comes back around, and the deck ends only when everything is resolved or deleted (or you close it); the count shows what's left. And with items ticked in select mode, the button becomes **Process selected (n)**: clarify a chosen few one-by-one — each its own way — leaving the rest for later. Closes #648.

## [0.9.0] - 2026-07-05

One processing model, bookmarks grown up. The wizard born in the capture dialog becomes *the* way
to process everywhere — the inbox's old verb toolbar (which the capture dialog once copied)
retires, and the Finder-style destination columns embed wherever you triage. Bookmarks graduate
from a static strip to a real system: reorder them, see and remove dead ones right in the menus,
one menu look everywhere — with a settings-and-dead-code cleanup riding along. A Codex pre-release
review hardened two edge cases before the cut.

### Added

- **See and remove bookmarks right in the menus.** The Projects/Contexts bookmark menus now show stale bookmarks greyed (project gone) instead of hiding them, and every row — live or stale — has a remove ✕ that works without closing the menu. Desktop no longer needs the phone list (or the bookmarked page itself) to clean up. Closes #594.
- **Bookmarks can be reordered.** Move up/down chevrons on the rows of the Projects/Contexts bookmark menus (the menu stays open while you fiddle) and on the phone More-sheet list. Each menu reorders within its own kind; the other kind's positions are untouched. The order is stored in the workspace, so it follows you across devices. Closes #636.

### Fixed

- **Pre-release review follow-ups.** ⌘/Ctrl+Enter now also picks the default destination (Free actions / Top level) in the project columns; a malformed or replayed bookmark-reorder can no longer duplicate a bookmark. Closes #645.

### Changed

- **Inbox bulk triage uses the processing wizard too.** The select bar's "File into ▾" chip, verb buttons, and popup picker are replaced by the same **Process…** wizard as the capture dialog (now one shared component): destination — with the Finder-style columns embedded right on the page and "New project here" — then status, then **Done**. One processing model everywhere. Closes #641.
- **The project picker's bookmarks are a menu now.** The chip strip above the columns is replaced by a compact **Bookmarks ▾** menu with the same rows as the command-bar bookmark menus (color dot + label) — pick one and the columns jump straight to that project. Jump-only here; managing bookmarks stays in the command-bar menus. Closes #642.
- **One less setting: "Bookmark appearance" is gone.** After the shell redesign it only styled the project picker's bookmark chips — those now always show their labels (reading beats hovering when you're browsing). The long-unused desktop toolbar bookmark strip was pruned from the code along the way. Closes #593.
- **Capture processing is now a wizard.** Instead of the inbox-style verb toolbar, select rows and hit **Process…**: the project selector appears right inside the dialog (the Finder-style columns; a native dropdown on phone), **Next** moves to the status choice (Next / Backlog / Make projects), and **Done** commits. Back/Cancel navigate without committing. Selection, Select all/Clear, and Delete-with-undo are unchanged. Closes #635.

## [0.8.0] - 2026-07-04

The capture dialog grows up: it keeps the whole capture streak (no cap, list-only scrolling),
becomes a full processing station (select rows, file them under a project with a status — the
inbox roundtrip is now optional), gets a remembered resize handle, and sheds its Add button.
Alongside: the long-standing "opened one action, saw another" Focus-mode mystery solved at the
root, plus a pre-release Codex review that hardened three edge cases before the cut.

### Added

- **Delete from the capture dialog's list.** Each "Just added" row now has a delete button — a mis-capture goes away on the spot, with the usual Undo toast as the safety net (and clicking Undo keeps the dialog open mid-streak). Closes #617.
- **The capture list keeps the whole streak.** Every item captured this session stays listed in the capture dialog — no size cap. Long streaks scroll inside the list while the capture field stays put; the phone bottom sheet is bounded so it can't outgrow the screen. (Replaces #617's short-lived "capture list size" preference, which never shipped in a release.) Closes #622.
- **Process straight from the capture dialog.** When a streak lands in one domain you often already know how to triage it — select just-captured rows and use the same toolbar as inbox bulk triage: **File into ‹project› ▾** (with "New project here"), **→ Next**, **→ Backlog**, **Make projects**, and **Delete** (one grouped Undo). Processed rows stay listed with a ✓-marker showing where they went; the inbox remains the home for captures that aren't clear in the moment. Closes #623.
- **The capture dialog is resizable.** Drag the bottom-right corner handle (or use arrow keys on it) to size it for a long processing session — the size is remembered per device. Closes #626.

### Changed

- **No more Add button in the capture dialog.** Enter (or the phone keyboard's Go) is the way to capture — the button was dead weight that taught the slow path. Closes #626.

### Fixed

- **Pre-release review follow-ups.** Space on a focused Focus-card control activates the control instead of marking the card Done; processing from the capture dialog now skips items deleted elsewhere (no false ✓ markers) and revalidates the picked destination right before filing; a remembered capture-dialog size re-clamps when the window narrows. Closes #628.
- **Focus-mode keys no longer fire behind the action editor.** With the editor open from Focus and keyboard focus on a button, `e` could swap the open dialog to a different card, arrows rotated the deck, Space marked the deck's card done behind the dialog, and Escape exited Focus along with it — the "opened one action, saw another" mystery. The deck's shortcuts now go quiet while any modal is open (the workbench's `x`/`y`/`z`/`s` got the same guard), the deck pins its current card by id so background changes can't swap it mid-click, the `e`/`r` keystroke no longer leaks into the freshly-focused title/rename field, and a deleted-then-restored action can no longer silently reopen its old editor. Closes #614.
- **The settings panel's header stays put.** Scrolling the panel's content no longer scrolls away the "Settings" header (with its ✕ close button) and the Account/Preferences tab strip — only the tab body scrolls. Closes #615.
- **The version tooltip works on the NAM logo.** Hovering the logo mark now shows the "Next Action Master · v… · build" tooltip — it was silently dead because the logo swallowed the tooltip's trigger props, which made the version unreachable in Dense mode (where the wordmark is hidden). The phone header's logo carries the same tooltip now too. Closes #616.

## [0.7.0] - 2026-07-03

The shell redesign: everyday actions move to a toolbar command bar, bookmarks become starting
points (with a Finder-style project explorer), Dense mode strips the labels once you know your
way, and Settings opens in a live side panel — hardened by a double pre-release review
(Codex + workflow) that fixed seven findings before the cut.

### Added

- **Dense mode.** A new **Settings → Preferences** toggle hides the labels next to the command-bar buttons and turns the sidebar into a narrow icon rail — for when you know your way around (tooltips still name everything). Off by default, per device. Closes #598.

### Changed

- **Settings open beside your work, not over it.** On desktop, the account menu's Account/Settings now open a **right side panel** — the workspace stays live next to it, so you see a preference (language, date format, …) take effect as you flip it. Close with ✕ or Escape; drag its left edge to resize (remembered). Phones and direct `/account` links keep the full page. Closes #599.

- **The project explorer shows its name.** The toolbar's project-explorer button carries its label ("Project explorer" / "Prosjektutforsker") like its command-bar neighbours, instead of being icon-only. Closes #597.

- **Browse from a bookmark (experiment).** Each project-bookmark row in **Projects ▾** is now split: the label opens the project as before, and a trailing **…** opens the Finder-style column picker in a new **open** mode, already navigated to that project — drill to a neighbouring sub-project and **Open** it. Bookmarks as starting points, not just endpoints: one hub bookmark (e.g. "NAM dev") reaches its whole subtree. A **project explorer** button beside Projects opens the same picker from the top — no bookmarks required. Closes #595.

- **A toolbar command bar (experiment).** Capture, Next, Contexts, Focus, and Projects move from the sidebar up to the toolbar as labeled buttons (with the bookmark quick-jump chevrons on Contexts/Projects) — so the everyday actions and bookmarks stay reachable even with the sidebar collapsed. The sidebar keeps Inbox, the Views group, and Organize (Goals, Templates). Closes #590.

- **Bookmarks moved into the sidebar (experiment).** Project bookmarks now live behind a small chevron on the **Projects** entry, context bookmarks behind one on the **Contexts** button — click the label to navigate as before, the chevron for the quick-jump list. The toolbar bookmark strip is gone (phone More sheet and the project picker's chips unchanged). Closes #588.

- **Tighter i18n safety net.** The `i18n:check` CI guard now also sees keys referenced via `<Trans i18nKey>` and aliased translators, so a missing catalog entry on those can't slip through. No user-facing change. Closes #581.

### Fixed

- **Settings panel polish.** Picking the other account-menu item while the panel is open now switches tabs in place; Escape aimed at an open dropdown no longer closes the panel with it; a mid-drag close can't leak the resize and save stray widths; and the Bookmark appearance help text no longer promises toolbar behavior the toolbar no longer has. Closes #608.

- **The project picker no longer forgets where you were.** While the picker was open, a background save or an update from another device could reset your column navigation and selection mid-browse — in move mode that could even confirm the wrong destination. Navigation now initializes only when the picker opens. Closes #607.

- **The toolbar fits small desktop windows.** Below ~1024px the command-bar buttons drop their labels automatically (icons, tooltips, and screen-reader names remain), so nothing clips or overlaps near the 768px desktop breakpoint. Closes #604.

- **Context bookmarks follow tag renames.** Renaming or deleting a tag now rewrites the tag-filter bookmarks that use it (labels included); a bookmark whose last tag is deleted is removed — previously it kept pointing at the old, empty filter. Closes #603.

- **The delete toast speaks Norwegian.** "Deleted …" / "Undo" on the delete toast were the last hardcoded English toast strings; they now follow the app language ("Slettet «…» — Angre"). Internally the status-undo hooks and the status name/color mappings were also deduplicated into one shared module. Closes #582.

- **The sync banner speaks Norwegian too.** The reconcile/save-failure notices ("Updated from another device…", "Couldn't save your last change…") were hardcoded English next to translated Retry/Dismiss buttons; the whole banner now follows the app language. Closes #580.

- **No more English flash for Norwegian users.** The app used to always start in English and switch to your language a moment after load; it now detects the stored/browser language before the first paint, so Norwegian users see Norwegian from the very first frame (and screen readers get the right `<html lang>` immediately). Closes #579.

## [0.6.0] - 2026-07-02

The app speaks Norwegian — the full i18n epic (runtime, every surface, a shared domain vocabulary
with NamDesktop, localized dates) — plus a batch of UX polish (status-change Undo toast, bookmark
and picker upgrades, sidebar Next/Contexts) and three fixes from the pre-release code reviews.

### Added

- **Undo a status change.** Changing an action's status (the status badge menu anywhere, Focus's Done/flip keys, Done's Restore/Backlog, and the bulk status operations) now shows the same short-lived **Undo** toast as delete — one click puts the previous status (and its original change-time) back. Handy when a row vanishes from the view you're in. Closes #567.

- **Choose how bookmarks look.** A new **Settings → Preferences → Bookmark appearance** option toggles bookmarks between compact **icons** (name on hover) and **icons with labels**, across the toolbar and the project picker. The phone More sheet always shows labels. Closes #560.

- **Jump to a bookmarked project in the picker.** The project selector now shows your project bookmarks as chips — click one to land straight on that (even deeply-nested) project, then drill further or confirm. The column strip also auto-scrolls to keep the active column in view as you go deeper. Closes #553.

- **Create a project while filing inbox items.** The inbox bulk "File under" picker now offers "＋ New project" (matching the other move pickers) — spin up a project and file the selected captures into it in one go. Closes #554.

- **The app now speaks Norwegian (Norsk).** Pick your language in **Settings → Preferences** (defaults to your browser's, persists per device) and the whole app follows — inbox, every action list, Focus, the editor, projects, tags, search, settings, and help. English is unchanged. Closes #400 (Phase B); date format stays a separate preference.

### Changed

- **No more redundant path on rows inside a project.** Action rows in the project page no longer repeat the ancestor-project path — the page header already shows it — freeing a line per row. Cross-project views (Next, Contexts, Due, Blocked, …) keep the path. Closes #569.

- **Action titles are tinted by status.** In mixed lists (Due, Blocked, Contexts, project workbench + columns), a title takes its status colour — Next, Done (green), Backlog (muted) — so status is scannable at a glance. No strikethrough. Single-status views (Next, Backlog, Done, next-only Contexts) stay uncoloured. Closes #565.

- **Faster access to Next + Contexts.** Next and the tag-filter view (now called **Contexts**) are prominent colored buttons in the sidebar, right under Capture — so "show my Next actions tagged _work_, then Focus" is a click away. Only the view is renamed; tags themselves are unchanged. Closes #557.

- **Tidier due date in the action editor.** The optional time-of-day and date-range fields now hide behind a small "＋ Add time or a range" toggle — so the common case is just a due date. They auto-expand when the action already has a time or range set. Closes #559.

- **Internationalization groundwork.** Added the i18n runtime (react-i18next + ICU message format) and began moving strings into a translation catalog (English master + Norwegian). English is unchanged; surfaces switch to Norwegian as they're translated. Foundation for #400.

- **Denser Column (Kanban) cards.** A card at rest is now just its title + meta — the row of controls (copy / rename / status / drag / delete) no longer reserves empty space below; it floats in on hover/focus instead. More cards fit per column, with no layout jump when you hover. Closes #514.

### Fixed

- **Dates speak Norwegian too.** Medium-formatted dates ("May 4, 2026") and the calendar picker's month header + weekday row were still hardcoded English; they now follow the app language ("4. mai 2026", "mai 2026", "ma ti on …"). The numeric formats (ISO, dd/mm, mm/dd) stay as chosen. Closes #575.

- **⌘/Ctrl+Enter no longer fires through stacked dialogs.** With the project picker open from the action editor (Move to…), one keypress used to confirm the move *and* save/close the editor underneath; and pressed inside the picker's "＋ New project…" prompt it confirmed the picker and threw away the typed name. The topmost surface now owns the shortcut. Closes #574.

- **A stale status-Undo can't overwrite a newer change.** If an action's status changed again while an earlier Undo toast was still showing, clicking that older Undo used to silently revert the newer choice; it now no-ops once the action has moved on. Closes #573.

- **Long names no longer break the capture dialog.** A very long name used to widen the dialog's content past its edge, pushing the **Add** button and the "Just added" rows' Copy/Edit buttons out of reach. Long text now truncates instead, and the underlying fix (the dialog's layout column is capped at the dialog width) guards every dialog against unwrappable content. Closes #568.

- **Status tooltip now fully translated.** The status badge's tooltip and screen-reader label showed the raw English status (NEXT/DONE/BACKLOG) even in Norwegian; they now use the translated name. Closes #565.

## [0.5.0] - 2026-06-30

Calendar-board polish — a date picker, end-date times, cross-month drag — plus three sync/data
fixes from a code review.

### Added

- **Copy names from the Column (Kanban) view.** The action card's copy icon now has a hover tooltip, and each sub-project column header gains a copy button for the project name (with its own tooltip) — previously you couldn't copy a column's name there. Closes #501.

- **Give the range end a time too.** The Due **end** date now takes its own optional time (so a window can read *Due 12 Aug 09:00 – 12 Aug 17:30*), same progressive entry as the start. Round-trips with NamDesktop. Closes #500.

- **A calendar to pick dates from.** Each Due field (start, end, and a project's due) now has a small **calendar** button — open it to see the month, navigate, and click a day to fill the date. Handy when you're planning and want to see what weekday a date falls on. Typing `yy-mm-dd` is unchanged and stays the fast path. Closes #499.

### Fixed

- **A failed save can't lose a later edit either.** Extending the #484 fix: once a write fails, further edits no longer commit on top of the unconfirmed change (which could overwrite it on success) — they're held until **Retry**, which re-pushes the whole local document and recovers them all. A remote sync is also held off while a failed edit is pending. Closes #507.

- **A same-day range can't end before it starts.** When a Due range's start and end are the *same day*, the editor now rejects an end time earlier than the start time (e.g. 14:00 → 09:00). Closes #508.

- **Importing a workspace keeps all the scheduling details.** Workspace import used to copy only the start date, silently dropping the range end and the start/end times. It now preserves `dueEndAt`, `dueTime`, and `dueEndTime` too, so an export → import round-trip is lossless. Closes #509.

- **Drag cards between columns while sorted By due.** In the Column (Kanban) view, dragging a card to another column (which reparents it into that sub-project) now works even when sorted **By due** — the calendar-board gesture: move a card from one month to the next. Only *within-column* reorder stays disabled under By-due (its order is computed). Previously By-due switched off all drag. Closes #502.

## [0.4.0] - 2026-06-30

Time-of-day on due dates — appointments land in NAM, not just all-day items.

### Added

- **Give a due date a time of day.** An action's Due now takes an optional **time** (a doctor's appointment at 14:30, a 09:00 call) — type it progressively: the hour alone works (`9` → 09:00), or `14:30` / `1430`. The row shows it after the date (*Due 12 Aug 14:30*), and the by-due sort orders within a day by time (all-day first). The range end stays date-only. Round-trips with NamDesktop. Closes #493.

## [0.3.1] - 2026-06-28

Bug-fix patch from a code review — including a data-loss fix on failed-write Retry.

### Fixed

- **A failed save no longer loses your edit on Retry.** When a write failed, the change was being reverted behind the sticky error notice, so **Retry** re-pushed the old document and could clear the error without restoring your edit. Now the failed edit stays visible and Retry re-pushes exactly that local change. Closes #484.

- **Project delete always starts on the safe defaults.** The advanced delete dialog was remembering your previous **Delete the actions / sub-projects** choices across separate projects; it now resets to **Move/keep** every time it opens, matching the “never lose work by accident” rule. Closes #485.

- **Keyboard shortcuts no longer fire behind a dialog.** While a modal (e.g. the project-delete or summary dialog) is open, app-wide shortcuts like <kbd>c</kbd> (capture), <kbd>/</kbd> (search), <kbd>t</kbd>, and the <kbd>g</kbd>-then-letter navigation are suspended, so a keystroke meant for the dialog can't act on the app underneath. Dialog keys (Escape, ⌘/Ctrl+Enter) still work. Closes #486.

## [0.3.0] - 2026-06-28

More small UX polish: keyboard copy for summaries, recent captures stay in view, and convert lands
you in the right place.

### Added

- **Copy a project summary with the keyboard.** In the Summary dialog, <kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>Enter</kbd> copies the Markdown **and closes** the dialog; the Copy button now has a tooltip naming the shortcut. (The button itself still copies without closing, so you can keep tweaking the filters.) Closes #477.

- **Capture keeps your last few items in view.** The capture dialog now lists the last 4 things you added this session under **Just added**, instead of letting each one vanish on Enter — handy when a thought relates to the previous one. Each is editable inline to fix a typo (it renames the real inbox item). The list is session-only and resets when you close the dialog. Closes #478.

### Fixed

- **Converting a project to an action lands where the action is.** Demoting a sub-project now drops you on its **parent** project's workbench (where the new action sits), and a top-level project — which becomes a *free* action — lands you on **Next**. Previously both bounced you to the top-level Projects list. Closes #479.

## [0.2.0] - 2026-06-28

A small UX pass: the version is reachable from the chrome, inbox delete is recoverable, and Summary
gets a shortcut.

### Added

- **The version is on the NAM wordmark.** Hovering the **NAM** logo label now shows the full name plus the release and build — *Next Action Master · v0.2.0 · a1b2c3d* — so the version is reachable while signed in without opening Help. Hover-only, so it adds no clutter. Closes #469.

- **Summary has a keyboard shortcut and a tooltip.** On a project workbench, press <kbd>s</kbd> to open the Markdown **Summary** (never while typing), and hovering the button now names it and shows the shortcut. Documented in Help. Closes #472.

### Fixed

- **Deleting an inbox item can be undone.** The inbox trash stays instant (no confirm dialog), but now shows the same short-lived **Undo** toast as delete elsewhere — so a mis-tap is one click to recover. Closes #471.

## [0.1.0] - 2026-06-28

First tagged release. NamWeb is the mobile-first web companion to NamDesktop — capture, triage, and
focus against the same Supabase backend. Everything below shipped on the way here.

### Added

- **The app now shows its version and build.** A small stamp — **NamWeb v0.1.0 · a1b2c3d** — appears in the Help page footer and on the sign-in / demo screen. The version comes from `package.json`; the short commit SHA (linked to the GitHub commit) identifies the exact build, so you can tell which Cloudflare preview you're on at a glance. A local dev build shows `dev`. Closes #464.

- **Triage several inbox items at once.** The inbox has a new **select mode** (the checkbox button beside "Process inbox"): tick the items you want — or **Select all** — then apply one shared decision from the bulk bar. Set the destination with **File into: … ▾** (defaults to **Top level / Free actions**), then commit with **→ Next**, **→ Backlog**, or **Make projects** — they all file into whatever the chip shows. **Delete** removes the lot with a single Undo. It's additive — the per-item **Process…** dialog and the **Process inbox** deck are untouched for one-at-a-time clarifying. Closes #458.

- **Select all in bulk select mode.** The Done view and the project workbench's action select-mode now have a **Select all** button next to Clear — tick everything in one go, then bulk-restore / -backlog / -delete (or move / tag / re-status on the workbench). Makes clearing out Done a two-click job. Closes #460.

- **Deleting a project now lets you keep its contents.** Deleting a non-empty project opens a dialog where you choose, per kind, whether its **actions** and **sub-projects** move up — to the parent project, or to **Top level** / **Free actions** when it's a top-level project — or get deleted with it. Defaults to moving them (never lose work by accident), and the whole thing is a single **Undo**. Empty projects just confirm. Applies wherever you delete a project (Projects list, sub-project rows, the workbench Details panel, the editor). Closes #454.

- **Give an action a date *range*, not just a due date.** The editor's Due field now has an optional **end** ("to") date, so multi-day things — a trip, a conference week — read as a span on the row (*Due 12 Aug – 16 Aug*). The start stays the sortable date, so due-sort and the Due view are unchanged. Round-trips safely with NamDesktop. Closes #438.

- **Flip new-item placement from the keyboard.** Press <kbd>t</kbd> anywhere to toggle whether new items add to the **top** or **bottom** — the keyboard mirror of the add-box toggle, applying to all add boxes at once. Never fires while typing; documented in Help. Closes #450.

- **Fold project sections from the keyboard.** On a project workbench, press <kbd>x</kbd> to toggle **Details**, <kbd>y</kbd> to toggle **Actions**, and <kbd>z</kbd> to toggle **Sub-projects** — collapse or expand each section without reaching for the mouse. Never fires while you're typing in a field. Documented in Help. Closes #436.

- **Sort a project's actions by due date.** A project workbench now has a **Manual / By due** toggle (beside the view switch). Switch to **By due** to order actions soonest-first (undated last) in both the list and the Kanban columns — handy for a calendar-style board where each column is a month. While sorted by due, manual reorder is paused (the order is computed); flip back to **Manual** to drag/▲▼ again. The choice is remembered per project. Closes #437.

- **A Finder-style picker for "Move to…" on desktop.** Moving an action from the editor now opens a macOS-Finder-style **column picker** — click a project to reveal its sub-projects in the next column and drill down to the exact destination, instead of scanning a long flat dropdown. Projects you can't move into (e.g. the item's own subtree) show greyed but stay navigable. You can also **create a new project right where you've navigated** ("＋ New project here") and move straight into it. Phone keeps the lightweight native select. First step toward one shared picker across all the "move / file under" surfaces. Closes #423.

- **The column picker now drives every "move into a project" on desktop.** The workbench "move sub-project", "move action", and bulk "move selected", plus "move project" in the Projects list, all open the same Finder-style column picker (the row's folder icon now opens it). Reordering and the kanban drag are unchanged. Phone keeps the inline dropdowns. Closes #425.

- **Inbox triage uses the column picker to file items (desktop).** When processing an inbox item, "File under" / "Nest under" now open the Finder-style column picker to choose the destination project — including creating a new project on the spot to file into. The resolve button still commits. Phone keeps the native select. Closes #426.

- **Delete a sub-project from its row.** Sub-project rows in a project's List view now have a trash button (with a confirm) — previously only top-level projects could be deleted from a row. Deleting one with children removes the whole subtree, with an Undo toast, just like the top-level delete. Closes #419.

- **Install to your home screen and land on the Inbox.** Added a web-app manifest with a fixed `start_url`, so a freshly installed home-screen icon always opens the app at the Inbox — instead of freezing to whatever page happened to be open when you added it. Closes #417.

- **See an item's notes on hover.** Action **and project** rows with a description now show it as a tooltip when you hover the title — in the action lists, the Projects list, and workbench sub-projects (long notes are truncated). Closes #203.

- **Move actions between projects.** On a project workbench, move an action (or several, in select mode) to a **sibling project**, **up to the parent project**, or out to **Free actions** — via a "Move to…" menu on the row and in the bulk bar. (From a top-level project, "up" means Free actions.) Closes #398.

- **Undo a delete.** Deleting an action or project (single, in Focus, or several at once in Done) now shows a brief **"Deleted … · Undo"** toast that puts it back — the whole subtree and any blocked-by links restored to where they were. Closes #392.

- **Bookmarks on your phone.** The "More" sheet now lists your bookmarks (labeled rows, tap to jump, tap × to remove) — previously they were desktop-only. Plus friendlier touch targets: row action buttons (copy/rename/delete), the reorder chevrons, and the bookmark remove ✕ are bigger and now reveal on touch instead of depending on hover. Closes #393.

- **App-wide keyboard shortcuts.** Press <kbd>c</kbd> to capture, <kbd>/</kbd> to jump to search, <kbd>?</kbd> to open Help, and <kbd>g</kbd> then a letter to go to a view (e.g. `g n` for Next, `g b` for Backlog). They never fire while you're typing in a field, and leave Ctrl/Cmd combos to the browser. Documented in Help. Closes #384.

- **Act on a Focus card with the keyboard.** In Focus mode, press <kbd>e</kbd> to open the editor, <kbd>r</kbd> to rename, <kbd>f</kbd> to move (re-triage to the other queue), and <kbd>Del</kbd> to delete (with the usual confirm) — alongside the existing arrows/Space/Esc. Each is a no-op when that action isn't available for the deck. Closes #385.

- **Bookmark what you keep coming back to.** A bookmark icon on a project or a tag filter pins it to the toolbar as a colored icon — one click jumps you straight back, and the tooltip names it. Hover a bookmark to remove it; a project bookmark whose project is gone greys out. Bookmarks **sync** with your workspace. Closes #386.

- **The demo starts with a few things in the Inbox.** "Try the demo" now lands with a handful of raw captures waiting to clarify — one of which naturally belongs under an existing project — so the Capture → Clarify loop and the Inbox Focus deck have something to act on right away. Closes #382.

- **Focus your Done list.** Done gets its own glowing Focus entry — flip through completed cards to re-triage the ones that weren't really done: the primary action restores to **Next**, "Move to Backlog" parks it, or delete it. Closes #367.

- **Act on a card without leaving Focus.** Each Focus card gets small controls: click its title to **open the editor**, a **pencil** to rename inline, a **copy** button for the name, and **delete** (with confirm). The deck flow is unchanged. Closes #365.

- **Select and bulk-act in Done.** The Done view gets a select mode — tick several completed actions and **Restore to Next**, move to **Backlog**, or **delete** them in one go (for the ones that were not actually done). Closes #366.

- **Focus your Inbox.** The "Process inbox" button now wears the green Focus glow — one tap drops you into the one-at-a-time clarify deck (make it an action or project, file it under a project, or delete). Closes #368.

- **Choose where new items land — top or bottom.** Each add box (Inbox, Next, Backlog, project workbench) gets a small **top/bottom toggle** so you can flip it right where you add — a here-and-now choice that resets to your default. The default lives in **Settings → Preferences**. Closes #369.

- **Save the editor with a keystroke.** The action/project editor now saves on **⌘/Ctrl + Enter** (and cancels on **Esc**), with tooltips on Save/Cancel showing the shortcut. Documented in Help. Closes #370.

- **Focus from more places, and it glows.** The **Next**, **Backlog**, and **Due** views gain a Focus
  button that drops you straight into the deck (Due focuses what's due now — overdue + today). Every
  Focus icon now wears a deliberate **green glow** — the one splash of colour in the neutral theme —
  so the "go do it" action stands out. The deck itself is unchanged. Closes #363.

- **Try NAM without an account.** A "Try the demo" link on the sign-in screen (and a `/demo` URL)
  drops you straight into a populated workspace — relatable sample projects (a trip, getting a dog)
  plus the Learn NAM project — so you can capture, clarify, Focus, tag, and browse with no sign-up.
  It runs entirely on your device (localStorage, no backend); a banner offers **Reset demo** and
  **Sign up to keep your work**. Closes #356, #357.

- **Copy a name from any list row.** Action rows, project rows, and inbox rows now have a small
  copy button that puts the item's name on the clipboard — no need to open the editor first.
  Closes #350.

- **Inherited project tags show on list rows (italic).** Action rows now display the tags a node
  inherits from its ancestor projects — rendered *italic* with a "From project" tooltip, alongside
  the action's own tags — so the rub-off is visible in the lists, not just the editor. Closes #328.

- **Delete a project straight from the projects list.** Project rows gain a trash button. It asks to
  confirm first — with a count-aware message ("…and its N items") for a non-empty project, since the
  whole subtree is removed. Closes #343.

- **New projects land first.** Creating a project — whether via *Add project* or *group actions into a
  sub-project* — now prepends it to the list (it appears first), matching how newly added actions
  already behave. Closes #326.

- **New inbox items appear first.** Capturing a thought now prepends it to the Inbox, so the latest
  capture is visible at the top without scrolling. Closes #332.

- **Copy buttons for names, descriptions, and resources.** A small copy-to-clipboard button now sits
  by the title and description fields (in the action editor and project Details panel) and on each
  attached resource — no more select-and-Ctrl-C. Closes #329.

- **Project tags rub off onto their contents.** A tag on a project now shows up (read-only) on every
  action and sub-project beneath it — in the action editor and the project Details panel — marked as
  inherited ("From project:") and not editable there. Filtering already treated these as effective
  tags; now they're visible where you edit. Edit them on the project that owns them. Closes #327.

- **File inbox items under an existing project while processing.** When you clarify an inbox item,
  you can now optionally choose which existing project it belongs to: actions gain a **File under…**
  picker (default *Free actions*), and *make a project* gains a **Nest under…** step (default *Top
  level*). Defaults preserve the previous one-tap behavior, so the common case stays fast. Often
  clarifying an item reveals it belongs to a project you already have. Closes #320.

- **Focus a single tag.** The **Tags** view gains a **Focus** button that drops you into Focus over
  the currently-filtered actions — e.g. filter to `home` and focus just those, when your Next queue is
  full of mixed contexts. The filtering stays in the Tags view, so Focus mode's UI is unchanged (it
  just gains a tag source, like `?project=` already does). The in-deck re-triage flip is omitted here
  (mixed statuses, like project focus). Closes #301.

- **In-app Help.** A new **Help** entry (account menu on desktop, More sheet on phone → `/help`)
  explains how NAM works (the Capture → Clarify → Focus loop), what each view is for, the keyboard
  shortcuts, and offers a one-click **Add the Learn NAM project**. A single home for "I'm confused."
  Closes #292.

- **First-run get-started on-ramp.** A brand-new (or still-empty) workspace now shows a dismissible
  card on the Inbox that names the **Capture → Clarify → Focus** loop and offers the two ways to
  begin — **Capture your first thought** or **Add the Learn NAM project 🥋** — instead of dropping you
  on a blank inbox. Auto-hides once the workspace has any content. Closes #291, #294.

### Changed

- **Shortcuts are now discoverable from the controls.** The desktop **Capture** button's tooltip shows **· c**, the toolbar search box wears a **/** key badge, the add-position toggle's tooltip mentions **t**, and the **Help** menu item shows **?** — so you can find the keyboard shortcuts without hunting through Help. Closes #453.

- **Quick-move an action *down* into a sub-project, and a clearer move menu.** The fast move menu for an action now also lists its current project's own **sub-projects** (drop an action a level deeper). The menu is grouped by direction — **up** (parent / Free / Top level), then **down** (sub-projects), then **sideways** (siblings) — separated, with a tooltip on each item naming its type (e.g. *Move to Kitchen (sibling)*) so the kinds stay learnable without cluttering the labels. Applies to action and project moves alike. Closes #433.

- **Fast move to a parent/sibling is back, with the picker one click away.** On desktop, the "move into another project" control (workbench sub-project / action / bulk move, and the Projects list) now opens a **quick menu** of the proximate destinations — the **parent project**, **sibling projects**, and **Free actions** / **Top level** — for one-click moves, plus **"Browse all projects…"** that opens the Finder-style column picker for anywhere else. Restores the immediacy the picker had buried. Phone keeps its dropdown. Closes #431.

- **MCP `add_action` defaults to Backlog.** New actions added via the MCP tool now default to **BACKLOG** (was NEXT), matching NamDesktop — capture first, promote to Next deliberately. Pass `status` to override. Closes #211.

- **The add box stays put while the list scrolls.** On Inbox, Next, and Backlog, the add box (and the sort/Process controls) is pinned at the top — scroll a long list and you can still capture or add without scrolling back up. Closes #149.

- **Desktop-first users aren't stranded on the no-workspace screen.** When you sign in and no workspace has synced yet, the welcome screen now reassures you that desktop data appears here once it's pushed to the cloud (same account), with a **Check again** button to re-pull — instead of only offering to create a fresh (empty) one. Closes #143.

- **Tags moved back to the sidebar.** With bookmarking now handling quick-jump, Tags' filtering role is what matters — so it sits in the sidebar (under "Find") with the other surfaces instead of the toolbar. Closes #399.

- **Bigger tap targets on touch.** Icon buttons (copy, delete/confirm, rename/prompt, the Done select toggle, and `size="icon"` buttons) now guarantee a ~44px hit area on touch devices, while staying compact for mouse. Closes #310.

- **Clearer, honest sync messages.** A sync notice now distinguishes a benign reconcile ("A newer change from another device was applied here" — amber, auto-dismisses) from a real failure ("Couldn't save your last change" — red, **stays put with a Retry**), so a change that didn't reach the server never quietly reads as saved. Closes #394.

- **Project Details autosaves.** Editing a project's details inline on its workbench no longer needs a Save click — text fields (title, notes, due) save when you leave them, and status/tags/resources save as you change them, with a quiet "Saved" indicator. (The action editor dialog keeps its explicit Save/Cancel.) Closes #390.

- **Help reflects the latest Focus and add-box features.** The Help page now describes Focus opening
  from Next/Backlog/Due/Done/Inbox with per-card actions and Done re-triage, Done's bulk select, and
  the top/bottom add toggle with its Settings default. Closes #380.

- **Create-account form has an obvious way back.** A prominent "← Back to sign in" now sits at the
  top of the sign-up (and forgot-password) form, so heading back to normal sign-in is one click —
  no hunting below the form. Closes #371.

- **Help page refreshed.** Adds Search to the views list, a "Good to know" section covering tag
  rub-off, archiving projects, and quick row actions, and notes you can file an inbox item under an
  existing project while clarifying. Closes #361.

- **Open an action by clicking it.** Click an action's title in any list to open its editor — the
  separate slider/edit icon on the row is gone. Rename (pencil), delete, status, and reorder keep
  their own controls. Closes #348.

- **Capture is a centered modal on desktop.** The quick-capture input used to slide in from the right
  on desktop; it now opens as a centered dialog (the bottom sheet stays on phones for thumb reach).
  Closes #342.

- **Add actions and sub-projects right in their lists.** The separate collapsible "Add to project"
  panel is gone; the add-action row now lives in the Actions section and the add-sub-project row in
  the Sub-projects section (with the template tools), each always visible so you can add even when a
  section is empty or collapsed. Closes #331.

- **Focus shortcut hint adapts to the device.** On a phone the deck no longer shows keyboard keys
  that don't exist there — it reads "Swipe to move · tap Done" on touch, and keeps the full
  "← → · Space · Esc" line on desktop. Closes #309.

- **Phone More sheet: grouped + descriptive.** The mobile **More** sheet was a flat list; it's now
  grouped (**Views** / **Organize** / **Find**, mirroring the desktop sidebar) with each surface's
  **description shown as a subtitle** — since tooltips don't fire on touch, that's how the per-surface
  hints reach mobile. Items are two-line with bigger tap targets, and the sheet scrolls. Closes #308.

- **Editor form fields stack on phones.** The action/project editor's **Tags + Due** were side-by-side
  (`grid-cols-2`) and cramped on a narrow screen; they now stack to full width on phones and only go
  two-up at `sm`+. Closes #307.

- **Tags reads as "engage", not just "admin".** The Tags view's prompt and the Help page now point
  out that you can **filter to a context (tag), then Focus just those** — surfacing the tag-focus path
  (#301) that was only discoverable after filtering. Closes #303.

- **Focus mode: shortcut hint + a guiding empty state.** The Focus deck now shows its keyboard
  shortcuts ("← → or swipe to move · Space to mark done · Esc to exit") under the counter, and the
  empty-queue state guides instead of dead-ending — "All clear 🎉 — capture a thought or move an
  action to Next, then come back." Closes #293, #296.

- **Empty states now teach.** Instead of a bare "No next actions." every empty surface explains
  what it's for and how to fill it — e.g. Next: "The things you've decided to do now. Add one above,
  or capture a thought and process it to Next."; Due/Blocked/Done/Backlog/Tags/Goals/Templates get
  their own purpose lines; Projects keeps its "Add the Learn NAM project" nudge. The shared
  `EmptyState` gains a headline + `hint` + optional `action`. Closes #290, #295.

- **Tooltips on the sidebar (parity with the toolbar).** Every sidebar surface and the Capture/Focus
  buttons now have a tooltip. Since the label is already visible, the tooltip is a short *description*
  of the surface (e.g. Inbox → "Capture and triage", Focus → "Work through actions one at a time")
  rather than an echo of the label. New optional `hint` on `NavItem`. Closes #288.

- **Sidebar grouped, and Focus promoted to a button.** The desktop sidebar was a flat list of ~10
  surfaces with **Focus** — a primary daily action — stuck last. Now **Capture** and **Focus** sit as
  the two buttons up top (the "do" actions, mirroring the phone bottom bar), and the rest is grouped
  into short labelled sections — **Inbox · Next**, then **Views** (Backlog · Due · Blocked · Done),
  then **Organize** (Projects · Goals · Templates) — so the list reads as chunks instead of a wall.
  Closes #286.

- **Tags moved from the sidebar to the toolbar.** Tags is more a manage-your-vocabulary *admin*
  surface than a daily view, so on desktop it's now a **Tag icon button in the top toolbar** (next to
  theme/account), mirroring how Search already lives there. The sidebar keeps the daily views; the
  phone **More** sheet is unchanged. Closes #284.

- **Open a project with all sections collapsed (clean landing).** A project's workbench now lands
  with **Details · Add to project · Actions · Sub-projects** all collapsed — a scannable overview you
  expand into, instead of a wall of content. The state is still persisted per-project, so your
  expansions stick; only the first-open default changed. To avoid losing track of what you add, a
  section **auto-expands when you add to it** (a new action, sub-project, or applied template), and
  deleting a project now redirects to the Projects list. Closes #279.

- **Edit a project on its workbench, not in a modal.** A project's details — title, notes, tags,
  due date, status, and resources — are now edited in a collapsible **Details** panel at the top of
  the project's own workbench (its home surface), beside the existing "Add to project" panel, instead
  of in the overloaded action dialog. The panel also carries the project **Delete** (recursive, with
  a count-aware inline confirm; deleting climbs to the parent project). To edit a project you simply
  **open it** (from the Projects list, or a sub-project from its parent workbench) and expand the
  Details panel — the per-row "edit details" (sliders) button is gone from both lists, since it now
  only duplicated opening the project. The shared `ResourcesEditor` is now its own module (reused by
  the action dialog and the panel), and the action editor no longer opens for project nodes. Closes #269.

### Fixed

- **Due dates fit, and you can clear them.** In the action editor the due field's start and end inputs now stack so a full date (e.g. *2026-07-04*) reads in each instead of being squeezed by the "to" layout, and a **Clear** link by the Due label empties the date (and its range) in one click. Closes #459.

- **Readable cards in the Column (Kanban) view.** Column cards used the full list-row layout, which didn't fit a narrow column — titles collapsed to a few characters and the due date wrapped down several lines. Cards now have a compact layout: the **title gets its own full line** (truncated with an on-hover full-name tooltip), the **due date sits on one line**, the redundant project path and "age" label are gone, and the row of action buttons (status, edit, rename, delete, drag, reorder) **moves to a footer that appears on hover** so it never crowds the title. Closes #445.

- **⌘/Ctrl+Enter now reliably saves the action editor.** The save shortcut used to miss intermittently when focus sat in one of the editor's pop-up controls (the tag suggestions, the "Move to…" picker, a date popover) — those render outside the form, so the keystroke never reached it. The shortcut now listens at the document level while the dialog is open, so it fires no matter which control has focus (still ignoring plain Enter and IME composition). Closes #435.

- **Switching a project's view now shows the change even when Sub-projects is collapsed.** The List / Heat-map / Column switch only restyles the Sub-projects section, so picking a view while that section was folded looked like nothing happened. Selecting a view now expands the section so the chosen layout is actually visible. Closes #418.

- **You can rename an inbox item on mobile.** The inbox rename pencil (and delete) were tiny tap targets that the touch pass had missed — they're now comfortably sized on phones, so a single tap starts an inline rename. Closes #411.

- **Inherited (rubbed-off) project tags now work like real tags everywhere.** Filtering already
  honored them; now **Search** matches a node's inherited tags too, and the **Tags** view counts
  reflect them — so a tag on a project behaves the same on its descendants as any tag they own.
  Closes #349.

- **Archived projects no longer leak their actions into the action views.** Actions inside an
  archived project kept their NEXT/BACKLOG status, so they still showed up in **Next** and **Backlog**
  (and Due, Blocked, Done, tag context, and Search). They're now excluded everywhere — archiving a
  project hides its whole subtree from the working views, not just the project rows. Closes #344.

- **Inbox pencil now renames in place instead of opening the action editor.** Tapping the pencil on
  an inbox item used to open the full action dialog — wrong, since the item hasn't been clarified as
  an action yet. It now starts an inline rename, like everywhere else (double-click still works too).
  Closes #333.

- **Deleting a sub-project returns you to its parent, not the root Projects list.** Deleting a project
  from its workbench used to always land on `/projects`. Now it navigates to the parent project when
  you delete a sub-project; only deleting a top-level project lands on the Projects list. Closes #330.

- **Archived projects no longer show up as move/file targets.** Every "choose a project" picker —
  *Move into* on the Projects list, *Move sub-project into* on the Workbench, the action editor's
  *Move to*, and the inbox *File under / Nest under* — used to list archived projects. They're now
  excluded, both when a top-level project is archived directly and for its sub-projects (which are
  archived transitively, since only the top project carries the ARCHIVED status). Closes #323.

- **Tag-scoped Focus keeps your selection on exit.** Filtering the **Tags** view and hitting Focus
  used to drop you back on a bare, unfiltered `/tags` when you exited. The tag filter (selected tags
  + "Next only") now lives in the URL, so exiting Focus returns to the same selection — and the
  filter is shareable/bookmarkable. First Codex external-review finding. Closes #316.

- **Get Started on-ramp is per account.** Its dismissal was stored under one browser-global key, so
  dismissing it for one account suppressed onboarding for another account on the same browser. The
  dismissal is now scoped to the signed-in user. Closes #317.

- **Focus shortcut hint keys off input, not viewport width.** The hint switched on the responsive
  breakpoint, so a wide touch tablet was shown keyboard keys and a narrow laptop only the touch hint.
  It now reads device capability — a fine pointer, upgrading the instant a real key is pressed — and
  keeps `useIsDesktop` for layout only. Closes #318.

### Added

- **Re-triage in Focus mode — fix bad planning in-flow.** Going through your **Next** queue in Focus
  and spotting a card that shouldn't be a Next, you can now **Move to Backlog** right there (and, when
  focusing **Backlog**, **Move to Next**) — a secondary action beside Done. The flipped card changes
  status, drops out of the current deck, and the next card slides in, exactly like Done — so you
  triage without leaving the flow. Deliberately the *only* addition: no edit/delete in Focus, and it's
  omitted for project-scoped focus (mixed statuses). Closes #277.

- **Resize columns in the Column (Kanban) view.** Each column gets a **drag handle on its right
  edge** to set its width — widen the one you're working in instead of living with fixed columns and
  unused screen space. Widths are **persisted per project + column** (localStorage); double-click a
  handle to reset, arrow keys nudge it (keyboard a11y). Mirrors the resizable sidebar. Closes #280.

- **Process Inbox — one-at-a-time deck.** A **Process inbox** button runs through every inbox
  item one at a time (Next / Backlog / Make project / Delete / Skip, with an "N left" counter),
  auto-advancing — clear the catch-all in one flow. Builds on the existing per-item process dialog.
  Closes #258.

- **Summary: include only the current project (toggle).** The project Summary dialog gains an
  **"Include sub-projects"** checkbox (on by default = whole tree); unchecked = just this project's own
  direct actions. Closes #257.

- **More bulk actions on selected actions.** The Select-mode bar on a project gains **Make
  sub-project** (name → new sub-project with the selected actions moved in; stays selecting so you can
  carve several groups), **Set status** (Next/Backlog/Done), and **Add tag** (with existing-tag
  suggestions) — alongside bulk Delete. New atomic `groupIntoSubProject` intent. Closes #259.

- **Import a workspace.** An **Import workspace…** button in the Projects view takes a NAM JSON
  export (the account "Export my data" bundle, or a single workspace document) and grafts it under a
  fresh `import-YYYY-MM-DD-HH-MM-SS` project — projects become sub-projects, free/Next actions +
  Inbox items become direct actions, all fields preserved, ids re-generated and blocker links
  remapped. A bundle with several workspaces nests each under its own sub-project. Invalid file →
  clear error, nothing imported. Closes #260.

- **Archive finished projects.** An **Archive** action on a project row tucks it out of the
  Projects list (using the existing ARCHIVED status), with a **Show archived (N)** toggle to bring
  them back and **Unarchive**. Keeps the list to what is live — same spirit as BACKLOG-default for
  Next. Closes #261.

- **Quick "Move into" another project.** Every project row — in the Projects list **and** the
  workbench's sub-project list — gains a **Move into…** button → a dropdown of targets (a **Top
  level** option when nested, its current **siblings first**, then other projects by path) → pick one
  to re-parent it. No full editor, works on desktop and mobile. (Replaces the abandoned
  drag-onto-nest attempt; plain drag-reorder from #222 is unchanged.) Closes #251.

- **Delete a project's done actions in one go.** A trash button on the project workbench's Actions
  header (shown when the project has done actions) opens a modal — "Delete N done actions in …?" —
  and clears that project's **direct** done actions (no recursion). Closes #250.

- **Select project actions for bulk delete.** A **Select** toggle on the project workbench's Actions
  header reveals per-row checkboxes and a selection bar (**N selected · Delete · Clear**); Delete
  removes the selected actions behind a count-aware confirm. Selection is session-only. First step
  toward broader bulk operations. Closes #249.

- **Copy a project summary as Markdown.** A **Summary** button on the project workbench opens a
  dialog with the project rendered as Markdown — the project title as `#`, each action as a heading
  with its tags (an italic `_Tags: …_` line) and its description as a paragraph (when present),
  sub-projects nested a level deeper — plus a one-click **Copy**. Status checkboxes (Next + Backlog
  on, Done off by default) filter what's included and regenerate live; sub-projects with no matching
  actions are pruned. Closes #245, #247.

### Fixed

- **Edit dialog: Save/Cancel no longer hide below a long form.** The action/project editor used to
  scroll header, body, *and* footer together, so once you filled in a description or added a few
  resources/blockers the **Save/Cancel buttons scrolled off-screen**. The dialog now **pins its
  header and footer** and scrolls only the body (new `DialogBody` region), and the occasional
  sections — **Resources**, **Blocked by**, **Move / make project** — are tucked behind disclosures
  (collapsed by default, auto-opened when they already have content), so the open dialog stays short
  (title · notes · tags · due · status) and the buttons are always reachable. Closes #268.

- **Heat-map accuracy.** An empty project no longer shows green ("all done") — empty cards are now
  neutral and read "no actions". And a project's own loose actions get their own **"Unsorted"** heat
  card (omitted when it has none), so a project with both sub-projects and direct actions no longer
  hides its own progress. Closes #224.

- **Top-level projects can now open the full editor.** Projects in the Projects list gained an
  "edit details" (sliders) button — previously only sub-projects could open the editor, so a
  top-level project's description/tags/due were uneditable. Closes #220.

### Added

- **Reorder top-level projects.** The Projects list now has up/down controls (everywhere) plus
  drag-and-drop on desktop, persisted to the project order — matching how sub-projects already
  reorder. Closes #222.

### Changed

- **List rows are easier to read across.** Subtle zebra striping + a full-row hover highlight on
  every list (Next, Backlog, Tags, Due, Blocked, Done, column cards, Projects, sub-projects, Inbox)
  so your eye tracks a row from its title to its right-side controls — the read-across cost of the
  full-width layout. Closes #218.

- **Workspace content now fills the screen width.** The content area was capped at ~900px and
  centered, wasting most of a wide display; it now uses the full width. Width is a single knob in
  `DesktopShell` (panels no longer cap themselves), so it's a one-line change to re-cap if a very
  wide screen feels too roomy. Narrow-by-design surfaces (Account/Settings, Focus card, auth) keep
  their widths. Closes #213.

- **Actions added inside a project now default to BACKLOG, not NEXT.** New project actions no longer
  flood the Next / Focus views before you've triaged them; the Next-view quick-add still adds NEXT.
  Matches NamDesktop's default. Closes #210.

### Added

- **"Learn NAM 🥋" onboarding project — learn by doing.** Add a ready-made project from the Projects
  view whose actions are real tasks you complete *on the project itself* to learn each feature
  (capture, triage, tags, Focus, due dates, blockers, Column view…), grouped into White / Yellow /
  Green belts. Finish them all and the heat map goes green — your NAM green belt. Doubles as a safe
  demo: delete the project to tidy up. Built on a new atomic, replayable `seedProject` intent. Part of #215.

- **Tooltips across the app — and full names where they're clipped.** Every icon/symbol button now
  has a themed, context-aware tooltip ("Rename *Buy tiles*", "Delete *Roof*", "Focus this project's
  actions", account icon → "Signed in as …") replacing the few native `title=` ones. And anywhere a
  project/action name is shown one-line — column cards, rows, sub-projects, the projects list — the
  **full name appears on hover, but only when the text is actually truncated** (no redundant tooltip
  when it already fits). New `Tooltip` + `TruncatedTitle` primitives (`src/components/ui/`). Closes #172.

- **Editor delete now confirms inline in the dialog (no native dialog left).** Deleting an
  action/project from inside the edit dialog asks for confirmation right in the dialog footer
  (count-aware message + Cancel / Delete) instead of `window.confirm`. This retires the last native
  dialog in the app — every confirm/prompt is now on-design. Closes #173.

- **Saved-view & template naming use anchored prompts.** "Save as view", saved-view rename, and
  "Save as template" now use the anchored `PromptButton` (themed inline input, Enter to save) instead
  of `window.prompt`. Part of #173.

- **Tags view: rename/delete use anchored popovers (no native dialogs).** Deleting a tag now uses the
  anchored confirm popover, and renaming a tag uses a new anchored **`PromptButton`** (themed inline
  input, Enter to save) instead of `window.prompt` — both right at the button, on-design. Part of #173.

- **Confirm deletes in an anchored popover (no more native dialog for row deletes).** Deleting an
  action/project from a row's trash now asks in a small **themed popover anchored to the trash
  button** — confirm is right where you clicked (no mouse-travel across the screen), Enter confirms /
  Esc cancels. New reusable `ConfirmButton` (`src/components/ui/confirm-button.tsx`, Radix Popover).
  Replaces `window.confirm` for the row trash across every list + column cards. First slice of #173
  (the editor delete, delete-tag, and the prompt cases follow).

- **Inline-rename a project in the Projects list.** Each project row gets a deliberate **rename**
  button (pencil) that flips the name to an inline editor (Enter commits, Esc cancels) — fast rename
  without opening the full dialog, and no accidental edits. Matches NamDesktop's double-click rename
  in spirit but uses an explicit, discoverable trigger. First slice of #168 (sub-projects + column
  headers to follow).

- **An action's project path is now clickable.** The ancestor-project breadcrumb shown on action
  rows (Next / Backlog / Due / Blocked / Done / Tags / workbench) links each project — click a
  segment to jump to it — matching the project workbench breadcrumb. New shared `ProjectPathLinks`
  component; `ActionRowData.path` now carries project ids. Closes #167. (Parity issue filed for
  NamDesktop: Aha43/NamDesktop#382. Focus/Search paths can adopt the same component as a follow-up.)

- **Add an action directly in the Backlog view.** The Backlog view gains a quick-add input (like
  Next's) that creates a `BACKLOG` action under the structural Actions node — no need to capture to
  the inbox first when you already know it's for later. Closes #169.

- **Inline trash on the column (kanban) view's cards.** The inline delete + confirm now also covers
  `ColumnView` action cards (was the one list left out of #164). Closes #175.

- **Inline delete (trash) on action rows, with confirm.** Every action list (Next, Backlog, Done,
  Due, Blocked, Tags results, project-workbench actions) now has a **trash button on each row** to
  delete without opening the editor — always behind the count-aware confirm (shared `useDeleteNode`
  hook, also now used by the editor's Delete). Done's old no-confirm "Delete" link is replaced by the
  confirmed trash, and the **Inbox** delete is now the same trash icon (kept instant — quick triage).
  Closes #164.

- **Environment-aware favicon (dev cue).** Outside production the browser tab shows a yellow
  "working" favicon (`public/favicon-dev.svg`) and an env-tagged title (e.g. `… [development]`),
  so you can tell at a glance whether a tab is local/dev vs the real `usenam.app`. Driven by a new
  `APP_ENV` (`src/lib/env.ts`: `VITE_ENV` → else dev/prod from the build); prod is untouched.
  Closes #163.

- **Manage tags — rename & delete in the Tags view.** The Tags view gains a "Manage tags" list
  showing each tag with its **usage count** and rename / delete controls, mirroring NamDesktop's
  tag management. **Rename** (`renameTag`) rewrites the tag across every item and the registered
  list (merging if the target exists); **delete** (`deleteTag`) removes it from the list and every
  item, with a confirm that names the count (`"Remove … from the tag list?"` when unused, else
  `"Delete … from N item(s)? This cannot be undone."`). Closes #159, closes #160.

- **Pick existing tags when tagging (autocomplete).** The action/project editor's tag field is now
  an autocomplete (`TagsInput`) that suggests existing tags as you type (↑/↓ + Enter/Tab, or click),
  mirroring NamDesktop's `TagsField` — so you select a known tag instead of retyping it, avoiding
  `@phone`/`phone` fragmentation. New tags can still be typed freely. Closes #158.

- **Create tags directly in the Tags view.** The Tags view gains a "Create a tag…" input that
  registers a standalone tag (new `registerTag` mutation → `registeredTags`, normalized/de-duped),
  so you can set up tags you have in mind without first finding an item to tag. On-the-fly tagging
  is unchanged. Closes #151.

- **Add a next action directly in the Next view.** The Next view gains a quick-add input (mirroring
  Inbox's) that creates a `NEXT` action under the structural Actions node — no need to capture to the
  inbox and process it first when you already know it's a next action. Closes #152.

### Changed

- **Focus a single project's actions.** The project workbench gains a **Focus** button (on the
  **Actions** section header, where it reads as "focus these") that opens the immersive Focus deck over
  that project's **open direct actions** (excludes done/sub-projects), via `/focus?project=<id>`.
  Mirrors NamDesktop's per-project focus mode. Closes #170.

- **Column-view headers: inline rename.** Sub-project column headers in the kanban view get the same
  deliberate **rename** pencil → inline editor. Completes inline rename everywhere a name shows
  (Projects list · action rows · sub-projects · column headers — #168). Closes #186.

- **Workbench sub-projects: inline rename.** Sub-project rows get the same deliberate **rename**
  pencil (→ inline editor) as actions/projects; the existing button (full editor) keeps its `Edit`
  label with the distinct sliders icon. Closes #185.

- **Action rows: deliberate rename, no accidental edits.** Action rows now have an explicit **rename**
  pencil (→ inline editor) instead of the undiscoverable, accidental-prone **double-click** to rename
  (removed). The full-editor button keeps its `Edit` label but gets a distinct (sliders) icon so the two
  don't look identical. Applies everywhere actions render (Next/Backlog/Due/Blocked/Done/Tags/workbench
  + column cards). Closes #184.

- **CI: e2e-mocked runs nightly + on-demand, not per PR/merge.** It's slow on busy runners (mostly the
  browser download) and, merging one PR per lap, a per-merge run was an e2e run every lap — so it now
  runs **nightly (cron) and on demand** (`workflow_dispatch`) only. The PR gate is `check`
  (typecheck/lint/test/build) + GitGuardian + the Cloudflare preview; the per-change gate is the
  **local e2e run before pushing**, with the nightly as the catch-all. Playwright browsers are now
  **cached** so the runs that do happen skip the re-download. `docs/ops/workflow.md` updated.
  Closes #187, #195.

- **Quick-added actions land first in Next & Backlog too.** Extends #174 to the flat lists: a quick-add
  in Next/Backlog now seeds the view's order so the new action appears at the top (those lists order by
  their own lens, not `childIds`, so #174 didn't cover them). Closes #181.

- **Newly added actions land first, not last.** `addAction` now prepends the new action to its
  parent's `childIds`, so a fresh action shows at the top of a project's actions / a column instead
  of at the bottom of a long list (childIds is the shared display order, so it shows first on desktop
  too once synced). Closes #174. (Parity issue filed for NamDesktop: Aha43/NamDesktop#386. The flat
  Next/Backlog lists order by their own lens, not childIds — unaffected here.)

- **Tags view: the manage controls are collapsible (collapsed by default).** The "Create a tag…"
  input and the "Manage tags" list (counts + rename/delete) now sit behind a **"Manage tags"**
  disclosure that's collapsed by default — so the filter chips + results have room when you're just
  filtering. Expand it to create/rename/delete. Closes #171.

- **Project workbench: header stays put while the lists scroll.** The breadcrumb, "Add to
  project" panel and view switch are now pinned (sticky) to the top of the content pane, so a long
  actions / sub-projects list scrolls beneath them instead of pushing them off-screen. First view
  converted to per-view local scroll (part of #149).

- **Lists scroll locally, in both directions.** The main content area is now a self-contained
  scroll region (both axes) with the app chrome — top bar, sidebar, phone header + bottom nav —
  pinned, so a long or wide list scrolls *within the pane* instead of scrolling the whole surface.
  Horizontal content (e.g. the column view) gets a horizontal scrollbar in its pane rather than
  stretching the page. Closes #149.

- **Thin, themed scrollbars across platforms.** Custom scrollbar styling (`src/index.css`) so
  Windows' chunky native scrollbars match the slim macOS overlay look and follow light/dark via the
  `muted-foreground` theme token (`::-webkit-scrollbar` for Chromium/Edge/Safari, `scrollbar-*` for
  Firefox). Closes #150.

- **Brand label shortened to "NAM" in the app chrome.** The logo in the desktop sidebar and the
  phone header now reads **"NAM"** instead of the long "Next Action Master" (which crowded the
  logo), with the full name kept in a hover tooltip (`title`) and on the sign-in screen. New
  `APP_SHORT_NAME` in `src/lib/app.ts`. Closes #148.

### Fixed

- **Web no longer depends on the desktop app to get started (launch blocker).** A brand-new,
  web-only user used to sign up, verify, sign in… and hit a dead end: *"No workspace yet — sync
  from the desktop app first."* The web app now **bootstraps its own empty workspace** — the
  no-workspace state offers a **Create workspace** button (`createDefaultWorkspace()` builds a
  document matching NamDesktop's `NamWorkspace.createDefault()` — root "NAM" → Inbox/Projects/Actions,
  `formatVersion: 1` — so desktop cloud-sync can still read the same row). Makes self-serve web
  sign-up actually usable. Closes #137.

### Added

- **Development & change-management workflow (`docs/ops/workflow.md`).** Documents the current
  working model now that prod exists: a **short line to prod** (no dev/staging — develop locally
  against the local Supabase stack, then push to prod), built on the principle that **risk is
  asymmetric** — frontend deploys are reversible (auto-deploy + PR previews + one-click rollback)
  so move fast, while schema migrations are irreversible and shared with NamDesktop so they get
  guardrails (backup-first, additive/expand-then-contract, review the SQL, migrate-before-code).
  Explicitly not permanent — graduates toward staging / migration-CI before the soft launch.
  Closes #146.

- **Ops docs — production topology + go-live playbook.** New `docs/ops/`: a living
  **`production-topology.md`** (the map — every service in prod NamWeb and how they relate,
  with a Mermaid diagram, inventory table, data/deploy flows, trust boundaries) and a
  **`go-live-playbook.md`** (the journey — ordered steps to take a Vite SPA + Supabase live on
  Cloudflare Pages, with the gotchas we actually hit, reusable for future web projects). First
  artifacts of the DevOps 1 sprint. Closes #139, closes #140.

- **Ops runbooks — cross-product workspace setup (`docs/ops/runbooks.md`).** A "when X, do Y"
  companion to the topology map and go-live playbook. First entries cover sharing one workspace
  between web and desktop in both directions (desktop adopts a web-created workspace via Pull;
  web adopts a desktop-created workspace via Push + reload), with the shared rules (one account,
  the `default` row, accounts are web-only, whole-workspace replace — no merge) and the footguns.
  Cross-links the related fixes: NamDesktop #380 / #381 and NamWeb #143. Closes #144.

- **Cloudflare Pages deploy config (launch).** Added `public/_redirects`
  (`/* /index.html 200`) so the SPA's client-side routes survive deep links and hard
  refreshes on the static host instead of 404ing. First piece of standing up public
  hosting on Cloudflare Pages at `usenam.app` (`docs/features/launch/design.md` §2);
  the rest (connect-to-Git build, prod env vars, custom domain) is dashboard config.
  Closes #135.

- **Sign-up consent gate (launch / GDPR).** Sign-up now requires ticking an **age (13+) + Terms &
  Privacy Policy acceptance** checkbox (links to draft `public/privacy.html` / `public/terms.html` —
  real copy + legal review pending), and supports **Cloudflare Turnstile** bot protection: an env-gated
  widget (`src/auth/Turnstile.tsx`, active only when `VITE_TURNSTILE_SITE_KEY` is set) whose token is
  passed to `signUp` for server-side verification. Inert in local dev. First slice of the launch
  go-live gate (`docs/features/launch/design.md`, `docs/compliance/gdpr.md`).

- **Account onboarding P1b — invite a friend (copy link).** The Account tab gains a **Copy invite link**
  button that copies a sign-up URL (`?invite`) to share however the user likes; the link opens the app
  **straight to sign-up** (`AuthScreen` reads the param). Client-only MVP — the send-from-the-app email
  version is deferred to when email infra (SMTP + an Edge Function) lands. Part of #123.

- **Account onboarding P1a — delete account.** The Account tab gains a **Danger zone → Delete account**
  flow: a confirm dialog (honest about removing your account + all cloud workspaces, on the web and any
  synced device; local desktop files untouched) that **nudges export first** and requires typing
  `DELETE`, then calls a privileged `delete_my_account()` RPC and signs out. The RPC (Aha43/NamDesktop#378
  — `SECURITY DEFINER`, scoped to `auth.uid()`) deletes the caller's workspaces then their auth user;
  verified end-to-end against the local stack. Part of #123.

- **Account onboarding P0d — change password.** The Account tab gains a **Change password** form (new
  password + confirm → `supabase.auth.updateUser`), reusing a shared `validateNewPassword` helper
  (`src/lib/password.ts`: match + ≥8 chars) that the sign-up/reset forms now also use. This completes
  the P0 account surface (sign-up · verify · reset · account page · export · change password). Part of #123.

- **Account onboarding P0c — Export my data.** The Account tab gains an **Export my data** button that
  downloads a JSON copy of all your workspaces (`src/lib/exportData.ts`: `buildUserExport` gathers the
  user's RLS-scoped `workspaces` rows; `downloadJson` saves them). Available anytime — the GDPR
  access/portability right, and what the future delete flow will nudge first. Part of #123.

- **Sign-up/reset password safety.** The `AuthScreen` sign-up and password-reset forms now have a
  **Confirm password** field and a client-side **sanity check** (passwords must match and be at least
  8 characters, with inline errors), so typos in a masked field don't slip through. Backed server-side
  by Supabase `minimum_password_length = 8` (Aha43/NamDesktop#376). Part of #123.

- **Account onboarding P0b — Settings/Account page + user-icon menu.** A top-right **account menu**
  (`AccountMenu`, replacing the gear + inline Sign out) opens to **Account · Settings · Sign out**, and a
  new routed **`/account`** page (`AccountPage`) hosts them as tabs: *Account* (signed-in email + sign
  out; password/export/delete land here in later slices) and *Preferences*. The date-format dialog
  (#104) is **absorbed** into the Preferences tab and the standalone `SettingsDialog` is removed. The
  phone **More** sheet gains the same Account / Settings entries. Part of #123.

- **Account onboarding P0a — self-serve auth.** The sign-in-only login is now a full `AuthScreen`
  (`src/auth/`) with **sign up** (email + password, requiring **email verification**), **forgot /
  reset password**, and sign in — the first step of NamWeb standing on its own as the primary product
  (see `docs/features/web-account-onboarding/design.md`, #123). `useSession` now catches the
  password-recovery redirect (`PASSWORD_RECOVERY`) and shows a set-new-password form. Sign-up and reset
  stay **neutral** (no account-enumeration leak). Verified end-to-end against the local Supabase stack
  (sign up → confirm link in the local mail catcher → sign in; reset email delivered). Requires the
  NamDesktop config change enabling email confirmations + the `:5173` redirect (Aha43/NamDesktop#374).

- Remote MCP server — **P4b hardened + branded consent page**. The OAuth login / workspace-picker /
  no-workspace pages are now Nam-branded (logo, card layout, light/dark) and security-hardened:
  **CSRF** protection on both form POSTs (`/nam/login`, `/nam/select-workspace`) via a double-submit
  cookie (httpOnly `nam_csrf` set at render, echoed as a hidden field, verified on POST), and an
  in-memory per-IP **rate limit** (10 sign-ins / 5 min → 429) to blunt credential stuffing. The server
  now trusts the proxy so `req.ip`/`req.secure` reflect the real client behind a tunnel/LB. New
  `mcp/auth/csrf.ts` + `mcp/auth/rateLimit.ts` (+ tests). Verified end-to-end against the local stack
  (CSRF cookie/field on `/authorize`; bad token → 403; full picker flow under valid CSRF; rate-limit
  → 429). This completes the onboarding-readiness work; only the deploy remains. Closes #119.

- Remote MCP server — **P4b per-user workspace (choose-at-consent)**. A connector now acts on a
  workspace the user **picks during sign-in**, instead of a single server-wide `VITE_WORKSPACE_NAME`
  env — required for a multi-user deploy. After authenticating, the consent flow lists the user's
  workspaces: one → used automatically; several → a picker page; none → "create one first". The choice
  is carried in the issued access/refresh token (`req.auth.extra.workspace`) and read per request in
  place of the global workspace name (the dev no-auth path still uses the env). The session is held
  between the credential and pick steps in a server-side, single-use **pending login** (new `AuthStore`
  method + `mcp.oauth_pending_logins` table), so it never travels through the browser. One workspace per
  connection; to switch, reconnect. Verified end-to-end against the local stack (DCR → login → picker →
  pick `dev` → token → MCP `list_inbox` returns `dev`'s inbox). Part of the P4b onboarding work (#117).

- Remote MCP server — **P4b honest read+write consent**. The OAuth server now advertises both
  `nam.read` and `nam.write` (was `nam.read` only, while 16 write tools shipped in P2), and **enforces**
  the distinction: a token granted only `nam.read` sees just the read tools — the write tools aren't
  registered for it at all. Granted scopes resolve to the client's requested∩supported set, or the full
  set when none is requested (the connector is read+write by nature). The sign-in/consent page copy now
  states honestly whether the assistant can **read** or **read and modify** your workspace, matching the
  scopes actually being granted. First of the P4b go-live readiness items (#115). New `mcp/auth/scopes.ts`
  (+ tests); write tools gated in `buildServer`.

- Remote MCP server — **P4a persistent OAuth store**. The `mcp/` server can now persist registered
  clients and issued access/refresh tokens to an **MCP-owned `mcp` Postgres schema** (`db/schema.sql`,
  created idempotently on startup; `pg`-backed `PostgresAuthStore` injected behind the existing
  `AuthStore` seam), so connectors no longer re-authorize on every restart. Enabled by setting
  `NAM_MCP_DATABASE_URL`; unset keeps the in-memory store (zero-config local path unchanged). The
  schema is the Authorization Server's own bookkeeping — reached via a direct service-level connection
  (not the user-JWT/RLS data plane) and not exposed to PostgREST, so the at-rest sessions stay off the
  public API surface. Verified against the local stack: OAuth state written by one server instance is
  read back by a fresh instance (simulated restart), with expiry-pruning and refresh single-use.
  Closes #113.

- A **Settings** dialog (the first one — Sprint 7), reachable from a gear button in the desktop
  toolbar and the phone **More** sheet. It holds a **Date format** preference (Medium `Jun 14, 2026`
  by default, plus ISO `2026-06-14`, Day/Month/Year, and Month/Day/Year), persisted per device to
  `localStorage` via a new `SettingsProvider`. The chosen format drives how due dates display
  (`formatDueHint`/`formatDate`); date entry still echoes canonical ISO, which round-trips through
  `parseFlexibleDate`. Closes #76.
- Remote MCP server — **P3 Realtime live updates**. An open SPA tab now reflects writes made by the
  MCP server (or NamDesktop, or another tab) without a reload. A new `src/sync/realtime.ts`
  (`subscribeToWorkspace`) subscribes to `postgres_changes` UPDATEs on the user's `workspaces` rows and
  `useWorkspace` reconciles **signal-then-pull**: a change event is only a nudge to re-`pull()`, and the
  remote snapshot is adopted only when it is strictly newer than the confirmed base *and* no local write
  is in flight — so own-write echoes and stale events are no-ops, and in-flight commits self-reconcile
  via the existing version guard (no new merge path). A catch-up `pull()` fires when the subscription
  first goes live, so a write landing in the brief window between the initial load and the channel
  activating isn't missed. RLS still scopes deliveries to the owner. Requires the `workspaces` table in
  the `supabase_realtime` publication (migration lives in NamDesktop). Verified end-to-end in a real
  browser against the local stack (external write → item appears live in the open tab, no reload).
  Closes #111.
- Remote MCP server — **P2 write tools**. The `mcp/` server can now *act on* the workspace, not just
  read it: `add_inbox_item`, `create_project` (top-level or nested), `add_action`, `add_next_action`,
  `mark_next`/`mark_done`/`mark_backlog`, `update_node`, `update_tags`, `move_node`, `delete_node`
  (leaf or recursive), `add_blocked_by`/`remove_blocked_by`, and `add_resource`/`remove_resource`/
  `edit_resource`. Each maps to a domain `Intent` committed via `commitIntent` (version guard +
  conflict-replay), runs under the signed-in user's RLS, and reuses the domain mutation invariants
  (the four structural containers are refused). Human control is connector-side per-write confirmation.
  Verified end-to-end against the local stack (write → read-back → delete). Closes #109.
- Remote MCP server — **P1 OAuth 2.1/PKCE**. The `mcp/` server is now its own OAuth 2.1 Authorization
  Server (`mcp/auth/`), backed by Supabase identity: a connector does the authorization-code + PKCE
  flow, signs in on a Supabase login page, and the server issues opaque access/refresh tokens mapped
  to that user's Supabase session — so every MCP request runs under their JWT and `owner_user_id` RLS,
  exactly like the SPA. Dynamic Client Registration is supported; tokens/clients are held in-memory for
  now (re-auth on restart). `NAM_MCP_DEV_NOAUTH=1` keeps the old no-auth shared-session path for the
  Inspector/local curl. The `mcp/` tree is now covered by `npm run typecheck` (`tsconfig.mcp.json`).
  Verified end-to-end against the local stack (DCR → PKCE → login → token → gated `/mcp`). Closes #107.
- Remote MCP server — **P0 read-only prototype**. A standalone `mcp/` server (`npm run mcp`, run via
  `tsx`, not bundled by Vite) exposes the Nam workspace over MCP (Streamable HTTP at `POST /mcp`) so the
  ChatGPT / Claude web surfaces can read it. It reuses the React-free core directly — `pull()` over the
  Supabase `workspaces` row plus the `domain/lenses` projections — behind ten desktop-parity read tools
  (`get_workspace_context`, `list_inbox`, `list_projects`, `list_next_actions`, `list_backlog`,
  `list_done`, `list_saved_views`, `list_project_children`, `find_node`, `list_resources`). No auth and
  no writes yet (later phases: P1 OAuth, P2 writes, P3 Realtime, P4 hosting). Design doc at
  `docs/features/remote-mcp/design.md`; usage in `mcp/README.md`. Closes #105.
- The brand `LogoMark` now appears next to the **Next Action Master** wordmark in the desktop sidebar
  header and the phone header, and a `favicon.svg` (mirroring the logo, light/dark-adaptive via
  `prefers-color-scheme`) is shown in the browser tab. Closes #101.

### Changed

- Wider desktop workspace: the surface panels (Inbox, Next, Backlog, Due, Blocked, Tags, Search, Projects,
  Done, Templates, Goals, and the project workbench) were double-capped — the shell limits content to
  `max-w-2xl` and each surface re-capped at `max-w-md` (~448px), leaving large left/right margins on desktop.
  The shell + per-surface caps are now `max-w-4xl` (~896px), so content fills much more of the screen.
  Short centered messages and the Focus deck keep their narrower widths; phone is unaffected. Closes #99.

### Fixed

- The Action edit dialog (and any tall dialog) no longer overflows small/phone screens: the shared
  `DialogContent` is now capped to the viewport (`max-h-[calc(100dvh-2rem)]`) and scrolls internally,
  so the footer (Save/Cancel) stays reachable instead of being clipped off-screen. Guarded by a
  phone-viewport E2E regression. Closes #74.

### Added

- Collapsible **Actions** and **Sub-projects** sections in the workbench **List** and **Heat-map** views:
  each section now has a header (chevron + count) that collapses its body — matching the per-column collapse
  in Column view. Collapsed state is persisted per-project (localStorage, via `useCollapsedSections`);
  defaults to expanded. Closes #98.
- Collapsible **Add to project** panel on the workbench: the add controls (Add action, Add sub-project,
  Add from template, Save as template…) are now grouped in a panel with a header toggle, so they can be
  tucked away on busy projects to free vertical space. Collapsed state is persisted per-project
  (localStorage, via `useCollapsedAddPanel`); defaults to expanded. Closes #97.
- Top toolbar strip on desktop: a full-width toolbar now carries the sidebar collapse/expand toggle and a
  **live search box** on the left, and the **theme toggle + Sign out** on the right — moved out of the
  sidebar. The toolbar search drives the Search surface via a `?q=` URL param (results update live) and
  persists across routes, so it keeps focus while you type. Search is removed from the desktop sidebar nav
  (still in the phone More sheet). `PhoneShell` is unchanged. Closes #96.
- Resizable + collapsible desktop sidebar: the divider between the view list and the workspace can be
  **dragged** to set the sidebar width (persisted to localStorage, clamped 180–480px; double-click resets,
  arrow keys nudge for keyboard a11y), and the view list can be **collapsed** entirely via a toggle — a
  small floating expand button restores it, maximizing workspace width. Desktop-only. Closes #95.
- Reorder Kanban columns (Workspace parity): each sub-project column in the **Column** view gains
  **left/right** move buttons, so the columns can be rearranged without drag. The **Unsorted** column
  stays fixed first; moving a column reorders the project's sub-projects (the same `reorderChildren`
  the List view's up/down buttons use). Unit + desktop E2E coverage. Closes #93.
- Column drag-and-drop (Workspace parity, phase 6b): in the workbench **Column/Kanban** view (desktop)
  you can now **drag actions within a column** to reorder them and **between columns** to reparent them
  — including into an empty column — landing at the drop position. Reuses the existing `reorderChildren`
  / `moveNode` intents (a cross-column drop runs `moveNode` then `reorderChildren`, computed from the
  deterministic post-move `childIds`). The within-column up/down buttons and the editor's **Move to…**
  stay as fallbacks. New `resolveColumnDrop` helper + multi-container dnd-kit wiring in `ColumnView`.
  Unit + desktop E2E coverage. Closes #91.
- Drag-and-drop reorder (Workspace parity, phase 6a): on desktop you can now **drag** rows by a grip
  handle to reorder them — the Next & Backlog lists (in "Unsorted" mode) and the workbench List view's
  direct actions and sub-projects. Reuses the existing `reorderView` / `reorderChildren` intents (a
  new `reorderKindWithinChildren` lens splices one kind's new order back into the parent's `childIds`,
  leaving the other kind in place). The up/down buttons stay as an a11y fallback and remain the only
  control on phones; drag is skipped for single-item lists. New `SortableList` / `SortableRow` /
  `ReorderableActionList` components (dnd-kit). Unit + desktop E2E coverage. Closes #89.
- Resources on actions & projects (Workspace parity, phase 5): the editor dialog gains a **Resources**
  section to attach links/notes (type — URI/EMAIL/FILE/TEXT — + value) and remove them, and rows show a
  **paperclip** when a node has resources. New `updateResources` intent (node-generic, replay-safe);
  `ActionRowData` carries `hasResources`. FILE is link/metadata only (no upload). Unit + desktop E2E
  coverage. Closes #87.
- Collapsible workbench columns (Workspace parity, phase 4): in the Column view each column has a
  collapse toggle (→ a narrow strip showing its title + count); the set of collapsed columns is
  **persisted per-project** in localStorage (mirroring desktop), so it survives reloads. New
  `useCollapsedColumns` hook; desktop E2E journey. Advances #64; closes #85.
- Workbench delete & project editing (Workspace parity, phase 3): the editor dialog gains a **Delete**
  button (confirms with the subtree size, then `deleteLeaf` or `deleteRecursive`), and now opens for
  **project** nodes too (title/description/tags/due/status, relabelled "Edit project"; action-only
  bits stay hidden). Sub-project rows in the workbench gain an **edit** affordance. Unit + desktop E2E
  coverage. Closes #83.
- Workbench Column/Kanban view (Workspace parity, phase 2): the project workbench gains a
  **List / Heat-map / Column** view switch (persisted per-project). **Column** mode (desktop-only)
  shows a leading **Unsorted** column for the project's own actions plus one column per sub-project,
  each with status menu, inline rename, **within-column up/down reorder** (via `reorderChildren`), and
  a per-column quick-add; cross-column moves reuse the editor's **Move to…**. New `ColumnView` +
  `useViewMode` hook. Desktop E2E journey. Advances #64; closes #81. (Drag-and-drop reparent/reorder,
  lanes, and collapse land in later phases.)
- Workbench reorder (Workspace parity, phase 1): a project's direct **actions** and its **sub-projects**
  can now be hand-ordered with up/down controls in the workbench. Unlike the Next/Backlog reorder (which
  uses `viewOrders`), this rewrites the parent's **`childIds`** — the structural order shared with
  NamDesktop, so the order shows up there too. New `reorderChildren` intent and `projectActions` /
  `subProjects` lenses (pure, tested), plus a desktop E2E journey. Closes #79.
- Manual reorder on the Next & Backlog lists: in **Unsorted** mode each row gets up/down controls to
  hand-order actions; the order persists in the synced workspace document (`viewOrders`, mirroring
  NamDesktop) and survives across devices. A pure `applyViewOrder` lens reconciles the saved order
  with live items (new ones appended, vanished ids dropped); a `reorderView` intent stores it. The
  Oldest/Newest sort modes stay computed (no manual controls). Tested (unit + a phone/desktop E2E
  journey). Closes #39.
- E2E mocked journeys — round two (Playwright): broadens the network-mocked suite to close out the
  testing base. **Triage breadth** (backlog status switch, due-date grouping, the blocked surface,
  and reshaping actions ↔ projects: Make project / Move to… / Convert to action); **Mission Control
  + templates** (create a Goal Board → station heat-map → drill, and the save-as-template /
  apply-template round-trip); and **error / conflict / empty states** — the REST mock gains
  `failFirstGet` (drives the load-error + Retry path) and `alwaysConflict` (forces a push conflict
  so the dismissible "Reloaded" sync notice surfaces). Closes #72.
- E2E network-mocked journeys (Playwright): a backend-free journey suite that intercepts the
  Supabase auth + REST calls (`page.route`, `e2e/mocks/`) and seeds an in-memory workspace
  document, so it runs fast and deterministically across a **desktop and a phone** viewport
  (iPhone 13). A reusable `mockedTest` fixture auto-installs the mocks and a `DocBuilder` seeds
  state per spec. First journeys: phone capture/focus/More navigation, projects workbench
  (create → drill → add → breadcrumb), tag filter + saved view, search, and a nav + dark-mode
  guardrail. Wired into CI as a PR gate (the real-Supabase smoke stays local). Closes #61.
- E2E scaffold (Playwright): a `playwright.config.ts` that boots Vite on a dedicated port against
  an isolated `e2e` workspace, signs in once (setup project → `storageState`), and runs a
  happy-path smoke (capture → process → Next → mark done) in **Chromium and WebKit** (the iOS
  Safari proxy) against the real local Supabase. Each browser project drives its own freshly
  seeded workspace row for full isolation. New `npm run e2e` / `e2e:ui` scripts. Closes #60.
- Apply template: an "Add from template…" picker in the project workbench instantiates a saved
  template's structure under the current project. The clone's fresh node ids are generated in the
  page and carried in the new `applyTemplate` intent, keeping it pure and replayable. Closes #68.
- Templates (save & manage): "Save as template…" in a project workbench captures its subtree as a
  reusable template (`saveAsTemplate`), and a new `/templates` route (and **Templates** nav entry)
  lists templates with item counts and delete (`deleteTemplate`). Closes #67.
- Goal Boards surface: a new `/goals` route (and **Goals** nav entry) — create tag-grouped Goal
  Boards (name + tags), open one to a heat-map of matching projects (done-ratio cards that drill
  into the workbench), and delete boards. Closes #66.
- Goal Board foundation: a `missionControlStations` lens (projects matching any of a board's tags,
  de-duped to the top-most, with done-ratio roll-ups via a shared `projectRollup`) and
  `createMissionControl` / `deleteMissionControl` mutations. Pure, tested. Closes #65.
- Search surface: a new `/search` route (and **Search** nav entry) — a query box searching titles
  and tags (case-insensitive, excludes done), with results tagged Action / Project and their
  project path; opening an action edits it, opening a project drills into its workbench. Closes #58.
- Saved Views: save the current tag filter as a named view and open / rename / delete saved views
  from `/tags`, plus a **Next only** toggle so views round-trip fully. New `createSavedView` /
  `renameSavedView` / `deleteSavedView` mutations over `doc.savedViews`. Closes #57.
- Tag-filter surface: a new `/tags` route (and **Tags** nav entry) to filter active actions by
  tags (AND) via toggle chips, with a live match count and the inline status menu / edit / rename.
  Closes #56.
- Tag & search selectors (`src/domain/lenses.ts`): `allTags`, `contextItems` (AND-match over
  effective own+inherited tags, optional NEXT-only), and `searchResults` (case-insensitive
  title/tag search). Pure foundation for the tag-filter and search surfaces. Closes #55.
- Blockers in the Action dialog: a **Blocked by** section to add prerequisites (a cycle-safe
  candidate picker) and remove them, plus a **Would unblock: …** hint — dispatched live via the
  editor provider. Closes #53.
- Blocked surface: a new `/blocked` route (and **Blocked** nav entry) listing actions awaiting
  prerequisites, grouped under each active blocker (the header opens that blocker). Closes #52.
- Prerequisites foundation: `addPrerequisite` / `removePrerequisite` mutations (cycle-safe via
  `canAddPrerequisite`) and `isBlocked` / `blockedGroups` / `unblocks` selectors — the
  dependency-graph core behind the Blocked surface and the dialog's blockers section. Closes #51.
- Due surface: a new `/due` route (and **Due** nav entry) grouping non-done actions with due dates
  by urgency — Overdue / Today / This week / Later (empty sections hidden) — with the inline status
  menu, edit, and rename. New `dueGroups` lens. Closes #50.
- Done surface: a new `/done` route (and **Done** nav entry) listing completed actions with
  restore-to-Next, move-to-Backlog, and delete. New `doneItems` lens. Closes #49.

- Workbench heat-map: a project with sub-projects can toggle its sub-project section to a heat-map
  of cards — each showing done/total and a done-ratio-coloured border (red/amber/green) — that drill
  in on click. New `missionStats` roll-up. Mirrors NamDesktop's MCR mode. Closes #47.
- Reshape items between actions and projects: the Action dialog gains **Make project** (lift an
  action to a project) and **Move to…** (reparent to another project or Free actions, excluding the
  item's own subtree); a leaf project's workbench offers **Convert to action**. Wires the
  `convertActionToProject` / `moveNode` / `convertProjectToAction` mutations. Closes #46.
- Project Workbench (`/projects/:id`): drill into a project — a clickable breadcrumb of ancestors,
  the project's own actions (full row parity: status menu, edit, inline rename), its sub-project
  sections (open to drill in), and quick-adds for an action or a sub-project. New `addAction`
  mutation; action rows now carry their status. Closes #45.
- Projects surface: a new `/projects` route (and **Projects** nav entry in both shells) listing
  top-level projects with their tags, a quick-add to create one (`addSubProject`), and open-into
  the workbench. Closes #44.
- Project hierarchy mutations (`src/domain/mutations.ts`): `addSubProject`, `moveNode` (reparent,
  with self/cycle/structural guards), `convertActionToProject` (lifts a free action to a top-level
  project), `convertProjectToAction` (leaf projects only), and `deleteRecursive` (subtree delete,
  sweeping `blockedBy` references). Pure, replayable, tested. Closes #43.
- Project hierarchy lenses (`src/domain/lenses.ts`): `projects` (top-level projects), `buildPath`
  (ancestor project chain for breadcrumbs; `projectPath` is now its string form), and
  `effectiveTags` (own + inherited ancestor-project tags). Pure, no UI — foundation for the
  Projects list and Workbench. Closes #42.

### Changed

- The Action dialog's **Due field now echoes a canonical date** on blur: relaxed entry like `26-7-4`
  normalizes to the zero-padded ISO form `2026-07-04`, confirming exactly what was parsed (invalid
  text is left untouched until save). The configurable date-format *setting* from #32 is deferred to
  the Settings surface. Closes #32.
- Due dates now match NamDesktop: the Action dialog accepts **flexible date entry** (`26-7-4`,
  `2026/6/15`, separators `- / .`, 2-digit year → `20YY`) via a ported `parseFlexibleDate`, with an
  inline error on bad input; and list rows show a compact, urgency-coloured hint (overdue / Today /
  `Nd` / short date) instead of the raw ISO string. New tested `src/lib/dates.ts`. Closes #31.
- UI now uses the full product name **Next Action Master** (via a single `APP_NAME` constant)
  instead of the internal "NamWeb" — on the login card, both shell headers, the logo's accessible
  name, and the document title. Repo/package identifiers stay "NamWeb". Closes #30.

- Interaction & a11y polish: the focus deck is **code-split** — framer-motion now loads on demand
  with the `/focus` route instead of in the initial bundle (clears the chunk-size warning; main
  bundle drops below 500 kB). The deck respects `prefers-reduced-motion` and announces its progress
  via `aria-live`. Closes #22.
- Restyled all existing surfaces onto the design system: Inbox, Next Actions, Backlog, `ActionRow`,
  Login, and the not-found / loading states moved from hardcoded `slate-*` classes to the dark-aware
  design tokens (`bg-card` / `text-foreground` / `text-muted-foreground` / `border-border` /
  `text-primary` / `text-destructive`), with the shadcn `Button` for primary actions. The app is now
  fully dark-mode-correct end to end. Closes #21.

### Added

- Inline status switch: each Next/Backlog row has a status badge (N/B/D) that opens a menu to set
  Next / Backlog / Done (replacing the ad-hoc per-row buttons), mirroring NamDesktop's clickable
  badge. Adds a shadcn `dropdown-menu` primitive (`@radix-ui/react-dropdown-menu`). Closes #37.
- FIFO/LIFO sort toggle on Next & Backlog: a toolbar control cycles unsorted → oldest-first →
  newest-first (by `createdAt`), persisted per-list in localStorage. Mirrors NamDesktop's clock
  toggle. Closes #38.
- Inline title rename: double-click a row's title (Inbox / Next / Backlog) to edit it in place —
  Enter commits via `updateNode` (preserving description), Esc or blur cancels. Shared
  `InlineRename` component. Closes #35.
- Relative age hint on rows: Inbox / Next / Backlog rows now show a compact age (`3d`, `2w`, `4m`,
  `1y`) from `updatedAt`/`createdAt`, amber once older than a week — mirroring NamDesktop's Age
  column. New `formatAge` in `src/lib/dates.ts`. Closes #36.
- Inbox Process dialog: an item can now be clarified — **one action** vs **needs planning (project)**,
  and for an action **do it next** vs **park for later (backlog)** — via a two-step dialog opened
  from the inbox row's "Process…" action (replaces the bare "→ Next"). New `convertInboxToAction`
  and `convertInboxToProject` mutations. Mirrors NamDesktop's ProcessInboxDialog. Closes #34.
- Configurable workspace identity: the synced workspace row is no longer hardcoded to `default` —
  it reads `VITE_WORKSPACE_NAME` (defaulting to `default`), matching NamDesktop's normal-mode
  (`default`) vs dev-mode (`dev`) naming so the web client can point at the right row (e.g. `dev`
  for local testing). Closes #27.
- Dev workspace switcher: a runtime workspace-name resolver (`src/lib/workspace.ts`, localStorage
  over the env default) plus a dev-builds-only "Use dev workspace" checkbox on the login screen
  that points the session at the `dev` row — so a developer can see NamDesktop dev-mode data
  without a rebuild. Seed of a future user-facing "Play" sandbox. Closes #28.
- Edit an action after capture: a reusable **Action dialog** (title, description, tags, due date,
  and status radios) opened from a pencil button on every Inbox / Next / Backlog row via an
  app-wide `ActionEditorProvider` (`useActionEditor().openEditor(id)`, mirroring the capture
  provider). Backed by new pure, replayable mutations — `updateNode`, `setDue`, `updateTags`
  (with tag normalization) — dispatched only for fields that actually changed, so edits replay
  through the conflict-retry commit. Closes #26.
- Form & dialog UI primitives: `Input`, `Textarea`, `Label`, and a shadcn `Dialog` (on the
  already-present `@radix-ui/react-dialog`) added to `src/components/ui`, styled on the design
  tokens and matching the existing `Button`/`Sheet` conventions. Primitives only — they unblock
  the Action edit dialog and later form-driven surfaces. Closes #25.
- Brand logo on the login screen: the NamWeb mark (ported from NamDesktop's `logo-mark.svg`,
  inlined as a `currentColor`-driven `LogoMark` component so it tracks the theme) now sits above
  the heading on the login card, dark-mode aware and with an accessible name. Closes #24.
- Focus execution deck — the centerpiece. An immersive full-screen `/focus` surface (outside the
  shell chrome, mirroring how desktop focus mode hides the toolbar) modeled on NamDesktop focus
  mode: one card at a time (project path, title, description) with an `N / total` counter, Done &
  advance (`setStatus DONE`), circular prev/next, and an all-done state. Keyboard (←/→/Space/Esc) and
  swipe (framer-motion) navigation, plus a Next/Backlog source toggle. Replaces the placeholder.
  Closes #20.
- Capture surface: an always-available quick-capture sheet (`CaptureProvider` + `CaptureSheet`)
  opened from anywhere via `useCapture().openCapture()` — both the phone center Capture button and
  the desktop sidebar Capture button now open it (no longer routing to Inbox). Stays open for rapid
  multi-capture, dispatches `addInboxItem`, and adapts its side (bottom on phone, right on desktop).
  Closes #19.
- Adaptive shell — the architectural spine. The form-factor split is now **IA, not just CSS**: a
  `useIsDesktop` breakpoint switches between a `DesktopShell` (persistent sidebar listing every
  surface, parity-ready) and a `PhoneShell` that pushes **capture + execution to the front** — a
  center Capture button and a Focus action in the bottom bar, with Backlog and the rest behind a
  **More** sheet. Shared `ShellContent` / `SyncNotice`; shadcn `Sheet` primitive added; shells
  styled on the dark-aware design tokens. Tests mock `matchMedia` for both form factors. Closes #18.
- Routing (React Router): real, deep-linkable routes — `/inbox`, `/next`, `/backlog`, `/focus`
  (placeholder), an index redirect to `/inbox`, and a not-found. The `useState` tab is gone; the
  shell is now a route layout (`AppShell` + `Outlet`, `NavLink` nav). Workspace state moved behind a
  `WorkspaceProvider` / `useWorkspaceContext` so the route pages (and both shells coming in #18)
  share one instance; surfaces split into page containers under `src/routes/`. Tests run against a
  deterministic Supabase test env. Closes #17.
- Design-system & theming foundation: shadcn/ui (Radix + Tailwind) wired up — `cn` util, `@`→`src`
  path alias, Tailwind theme tokens via CSS variables, `tailwindcss-animate`, `lucide-react`, a
  `Button` primitive, and a dark-mode `ThemeProvider`/`ThemeToggle` (default dark to echo the
  desktop, no-FOUC inline script, persisted to localStorage). Surface restyle comes later. Closes #16.
- Conflict + empty/error polish: the sync notice now auto-dismisses after ~4s (still manually
  dismissible), and a failed initial load shows the error with a Retry button that re-runs the pull
  (`useWorkspace` gains `retry`). Rounds out the empty/no-remote/error states across the app.
  Closes #9.
- Backlog UI: the `backlog` tab renders the `backlogItems` lens (reusing the shared `ActionRow`)
  with a single promote-to-Next action (→ `setStatus NEXT`). All three MVP tabs are now functional.
  2 tests. Closes #8.
- Next Actions UI: the `next` tab renders the `nextActions` lens with project path, tags, and a due
  hint, and mark-done / send-to-backlog actions (→ `setStatus`). New `projectPath` lens helper
  (ancestor project titles, structural containers excluded) and a shared `ActionRow`/`ActionList`
  presentation plus `toActionRow` mapper (reused by Backlog next). 6 tests (panel + projectPath).
  Closes #7.
- `make dev` one-command launcher (`makefile` + `scripts/dev-up.ps1`): ensures npm deps and `.env`
  are present, checks whether the local Supabase stack is up on `127.0.0.1:54321` and starts it from
  the sibling NamDesktop repo if not (waiting until ready), then runs `npm run dev`. Cross-platform
  PowerShell (TcpClient port probe, no Windows-only cmdlets). Thin `make run/test/build/lint/install`
  passthroughs too. Closes #10.
- Inbox UI: the workspace now runs end-to-end. `AppShell` consumes the `useWorkspace` hook (wired
  via a new `AuthedApp`), renders the inbox via the `inboxItems` lens, and shows loading / no-remote
  / dismissible sync-notice states. New `InboxPanel` (`src/features/inbox/`) provides quick-add
  capture (the headline flow → `addInboxItem`), convert-to-Next, and delete, with an Inbox-zero
  empty state. `src/lib/local.ts` supplies node ids and Java-`LocalDateTime`-compatible timestamps.
  11 tests (InboxPanel + AppShell states). Closes #6.
- Workspace store + mutations: intent-based pure mutations (`src/domain/mutations.ts` —
  `addInboxItem`, `convertInboxToNext`, `setStatus`, `deleteLeaf`, each replayable), the optimistic
  single-flight commit with intent-replay conflict-retry (`src/store/commit.ts` — push guarded;
  on conflict pull, re-apply the same intent, push once more; bounded give-up that surfaces a
  "reloaded" notice; handles vanished node / vanished row), and the `useWorkspace` hook
  (`src/store/useWorkspace.ts`) that loads the `default` row, holds the snapshot, and serializes
  dispatched intents. 15 unit tests on the pure core (mutations + every commit branch). No UI yet.
  Closes #5.
- Auth + session: Supabase client (`src/lib/supabase.ts`) from `.env` vars, a `useSession` hook
  tracking sign-in/sign-out, and an email/password `Login` form with error states. The app is gated
  behind login — `App` shows `Login` until there's a session, then the `AppShell` (now with a Sign
  out button). Shell extracted from `App` into `AppShell` for clean testing. 5 tests (login submit +
  error, shell tabs + sign-out). Closes #4.
- Workspace sync client (`src/sync/workspaceClient.ts`): `pull(name)` and `push(name, document,
  guardVersion)` over `@supabase/supabase-js`, mirroring the NamDesktop cloud-sync contract —
  version-guarded update, first-push insert, and conflict detection (guarded update matches zero
  rows → fetch to disambiguate first-push from a stale-version conflict). Typed `PullResult` /
  `PushResult`. 9 unit tests against a mocked Supabase client. No UI. Closes #3.
- Domain model + lenses (`src/domain/`): TypeScript mirror of the NamDesktop workspace document
  (`NamNode`, `NodeStatus`, `WorkspaceDocument`, with field names matching the Jackson JSON blob)
  and pure lens selectors ported verbatim from the Java lenses — `inboxItems` (inbox children, any
  status), `nextActions` (NEXT, non-project, non-structural), `backlogItems` (BACKLOG, non-project,
  not an inbox item), plus `structuralNodeIds`/`buildParentIndex` helpers. 15 unit tests. No UI.
  Closes #2.
- App scaffold: Vite + React + TypeScript SPA with Tailwind CSS, `@supabase/supabase-js`, and
  TanStack Query. Mobile-first app shell with a bottom nav (Inbox / Next / Backlog placeholders),
  `.env.example` defaulting to the local Supabase stack, Vitest + Testing Library setup with a
  shell smoke test, ESLint flat config, and `npm run dev/build/test/lint/typecheck` scripts.
  Stack decided in the first planning session; the MVP talks directly to Supabase (no web API).
  Closes #1.
- Repository bootstrap: project conventions (`CLAUDE.md`, `README.md`, `LICENSE`, `.gitignore`,
  `VERSION`), GitHub issue templates, and the web-app design thread carried over from NamDesktop
  (`docs/features/web-app/design.md`). No application code yet — the frontend stack and first
  epics are decided in a planning session.

[Unreleased]: https://github.com/Aha43/NamWeb/compare/v1.12.1...HEAD
[1.12.1]: https://github.com/Aha43/NamWeb/compare/v1.12.0...v1.12.1
[1.12.0]: https://github.com/Aha43/NamWeb/compare/v1.11.0...v1.12.0
[1.11.0]: https://github.com/Aha43/NamWeb/compare/v1.10.0...v1.11.0
[1.10.0]: https://github.com/Aha43/NamWeb/compare/v1.9.0...v1.10.0
[1.9.0]: https://github.com/Aha43/NamWeb/compare/v1.8.0...v1.9.0
[1.8.0]: https://github.com/Aha43/NamWeb/compare/v1.7.0...v1.8.0
[1.7.0]: https://github.com/Aha43/NamWeb/compare/v1.6.0...v1.7.0
[1.6.0]: https://github.com/Aha43/NamWeb/compare/v1.5.0...v1.6.0
[1.5.0]: https://github.com/Aha43/NamWeb/compare/v1.4.0...v1.5.0
[1.4.0]: https://github.com/Aha43/NamWeb/compare/v1.3.0...v1.4.0
[1.3.0]: https://github.com/Aha43/NamWeb/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/Aha43/NamWeb/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/Aha43/NamWeb/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Aha43/NamWeb/compare/v0.10.0...v1.0.0
[0.10.0]: https://github.com/Aha43/NamWeb/compare/v0.9.1...v0.10.0
[0.9.1]: https://github.com/Aha43/NamWeb/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/Aha43/NamWeb/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/Aha43/NamWeb/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/Aha43/NamWeb/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/Aha43/NamWeb/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/Aha43/NamWeb/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/Aha43/NamWeb/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/Aha43/NamWeb/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/Aha43/NamWeb/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/Aha43/NamWeb/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Aha43/NamWeb/releases/tag/v0.1.0
