# Release footprints

The **"footprint since last release"** paragraph reported at every cut (a ritual since v0.4.0,
codified in [RELEASING.md](RELEASING.md)) — archived verbatim, newest first, for historical
analysis: themes over time, converging-vs-polishing calls, and process experiments as they
happened. This is deliberately *not* the CHANGELOG: the CHANGELOG says what shipped; a footprint
says what the work *was about*.

Releases before v0.9.0 (v0.4.0–v0.8.0) predate this archive — their footprints were reported in
chat only. Their CHANGELOG summary lines are the surviving record.

---

## v3.0.0 — 2026-08-04

*(the milestone cut — one meaty feature + one papercut + a two-P2 pre-cut review; 3 work PRs; **major**)* **The one that replaced Trello.** Not a feature milestone — a *usage* one, and the first NamWeb major cut for what the tool has *become* rather than what it gained. The whole 2.x series was the author hardening NAM against his own daily life (capture-in-context, the calendar, inbox/convert flows, system tags growing into Features), until at some point it stopped being the thing being built and became the thing *relied on*. That wasn't a decision so much as something noticed — Trello went quiet, opened only to migrate the last cards across, and stayed quiet for weeks. 3.0.0 draws the line at that moment: personally production-ready. Fittingly, the final sprint closed an **original-spec item from the pre-NAM Blazor build that only real use resurfaced**: **persistent manual ordering in context (tag) views** (#1036) — drag actions into the sequence you'll work them, persisted per context, in the view where you *engage* with work rather than only in a project's home. The engine was ~80% already there — the generic `viewOrders` / `applyViewOrder` / `reorderView` / `mergeVisibleOrder` that Next/Backlog use is keyable by any string — so the work was a stable tag-set key plus wiring the shared `ReorderableActionList` into `TagFilterPanel`: an earlier abstraction paying a late dividend. The **mandatory Codex gate earned its keep on the milestone cut too**, finding two state-consistency P2s the inline pass missed (#1041): the context key **wasn't injective** (`['a+b']` and `['a','b']` both produced `context:a+b`, so reordering one silently overwrote a sibling context's order → URL-encode each canonical tag before the `+` join), and **renaming a tag abandoned its manual order** (the live context kept its nodes/bookmark but lost its sequence, and multi-tag orders orphaned → the `renameTag` reducer now migrates every `context:*` key, merging deterministically when the destination already has an order, with a symmetric delete cleanup; `contextViewKey` moved into the domain so the migration is atomic and replay-safe with sync). Both are the read/write-consistency class Codex reliably surfaces where the inline eye under-weights it — the same lesson as the v2.11.0 share-gating pair. A **milestone, not polish** — the marker itself is the point: NAM crossed from "a project being built" to "infrastructure for one person's work," and the release notes deliberately tell *that* story rather than a feature list. Process was clean and quick — five PRs across the two-issue sprint, tidy merges, cut on the first green after the review fixes. Next: **3.x is the AI era** — AI-on-NAM via MCP (the POC proven back in NamDesktop's chat→"make it in NAM"→execute flow, MCP already reimplemented here), to start **Labs-dark** like sharing did; the author is writing an alternative-angle exploration input before engaging. The phone friction item parked this sprint waits for that same more-thought.

## v2.11.0 — 2026-08-04

*(two themed dogfooding sprints — paths/targets, then system-tags-as-Features — plus a follow-up tweak and a pre-cut Codex-fix PR; 6 work PRs; minor)* **System tags grow up into Features — the `#`-namespace arc finally gets a front door.** The headline closes a loop opened back at #837 (the `#` sigil reserving system tags) and #909 (`#not-stalled`): those tags are *functional* — they flip a behaviour — but until now you applied them by hunting a `#`-tag from a dropdown and decoding its name. This cut gives them a proper **Features dialog** (#1023): one row per applicable behaviour, a checkbox and a plain-language description, reached from the **action editor** and the **project workbench header** (the flag icon the user singled out as "perfect for this"). The design leaned on a **descriptor registry** (`SYSTEM_FEATURES` + `featuresFor({isProject, inShare})`) deliberately shaped richer than a 1:1 tag↔checkbox map, so a future combo-box row or a checkbox that sets several tags is an extension not a rewrite — and a **presentational dialog** (`tags` + `onToggle`) so each host wires the toggle correctly: the workbench header **dispatches live**, while the action editor **edits its unsaved buffer** to save atomically (no dispatch-vs-Save race). Then, over three dogfooding follow-ups, the loop was *completed*: system tags were pulled **out of the tag admin** (#1024) and **out of the type-ahead** (#1028) — set *only* via Features now — while staying **filter chips** (you can still slice by `#in-progress`), each chip carrying a **tooltip** pointing back to Features. Around the headline, two **engage-in-context** wins the user surfaced while working: the **Focus deck's path went live** (#1019 — each ancestor project links to its workbench, so the breadcrumb becomes the "jump to the project mid-work" step), and **move/file destination lists are depth-first sorted** (#1020 — a pure `projectIdsDepthFirst` walk replacing hash-map `Object.values` order, so a *flat* list finally reads like your tree — the mobile-move friction the user hit "in the pub waiting for a match," gone). A paths **audit** the user requested confirmed the deck was the *only* plain breadcrumb left — the app was already good there. The **mandatory Codex gate earned its keep yet again**: my inline pass came back with three low non-blocking notes, but Codex caught **two real P2s** of the state-consistency class the inline eye keeps under-weighting — the `#shared-*` feature gating **went stale after publish/unpublish** (`useSharedProjectIds` snapshotted owner shares once on mount while `ShareDialog` mutated them without invalidating — the classic read-a-snapshot-never-refreshed bug; fixed with a tiny `shareEvents` signal that refetches all consumers), and the dialog let **"Hidden from share" and "Force-shown" both be checked** even though the share rules make hide override show, so Force-shown was a false promise (fixed with a `supersededBy` descriptor field that disables + explains the overridden row). Both hardened in #1032 before the tag. **Converging, decisively** — this is the tag-namespace arc reaching its natural destination (a *behaviour* deserves a UI, not a tag you memorise), and it's the deliberate last-polish before a milestone: the user has framed **3.0.0 as "the one that replaced Trello"** (a *usage* milestone — Trello's gone quiet for weeks), to be cut after **one final dogfood sprint** whose meaty headline is already chosen: **persistent manual ordering in context views** — an original-spec item from his old Blazor build that dogfooding resurfaced, and which turns out ~80% built already (the generic `viewOrders` / `applyViewOrder` / `reorderView` / `mergeVisibleOrder` engine Next/Backlog use is keyable by any string; the work is a tag-set key + wiring the DnD list into the context view). Process note banked (again): a **stacked PR whose base branch is deleted on merge gets auto-*closed*, not retargeted** — #1026 (the chip-tooltip, genuinely dependent on the Features registry) died when #1025 merged; recovered by rebasing onto `main` (the squashed base skipped cleanly) and reopening as #1027. Lesson reinforced in [stacked-pr-squash-gotcha]: **retarget the dependent to `main` before merging the base.** Next: the persistent-context-ordering sprint → **3.0.0**, whose release notes should tell the off-Trello / real-use story, not a feature list.

## v2.10.0 — 2026-08-03

*(a dogfood sprint — one meaty feature + three tweaks + a vetted deps sweep; 6 commits; minor)* **Capture-in-the-moment reaches the inbox, and the deps get a quiet cleanup.** The headline **completes a pattern** the previous cut started: v2.9.0 let *converting an action* to a project seed its first actions in the moment; this cut brings the *same brain-dump to the inbox* (#1007) — when you clarify an inbox item as "needs planning", the item name becomes the editable/copyable project name and you jot the first action names right then. The reuse was the point: the exact `ConvertToProjectDialog` from #1000 is now shared by the action editor **and** the inbox process dialog, differing only by an inbox-specific **two-button footer** — *Create & open project* vs *Create & keep processing* (the deck advances). The user, who logged the idea as "very similar and natural for the same reasons," confirmed it "seems working well as in very." Around it, three legibility/correctness tweaks pulled straight from using the app: the heavily-used per-row **move-to** menu got quiet **section headers** (Parent / Sibling / Sub-project / Top level · Free actions) so it stops reading as "some seemingly random projects" to a newcomer (#1009); the **inbox count** finally shows on the **dense** sidebar rail as a corner badge, not just the red glow (#1008); and a **done** action stops painting its past due date **red** — it isn't overdue, it's finished (#1010, a `muteTone` on the shared `DueHintLabel`). Also this cut, a **dependency sweep**: three stale Dependabot PRs (dev-minor, prod-minor supabase/framer/lucide, and **jsdom 29→30**) were **vetted as one batch** — applied together on a branch, full gate green (996 unit on jsdom 30 run twice, 160 e2e) — then consolidated into a single `chore(deps)` PR (#1015) rather than nursing three stale PRs through rebase-and-flake-retry; a reusable trick for dep backlogs. A happy side effect: **jsdom 30 appears to have quieted the long-flaky `#832/P2` sharing test**, which had bitten nearly every merge for weeks and didn't fire across three runs on the new version (watching whether it stays dead). The dual review was a **clean sweep in the good sense**: the inline pass caught a real bug before Codex — the inbox deck's `←/→` window listener guarded against the project picker but not the *new* brain-dump layer, so an arrow with a button focused would advance the deck underneath the modal (#1016) — and then **Codex found nothing at all**, a first in a while and a nice signal that the inline discipline is catching the lifecycle/guard classes it used to miss. Squarely **polishing** — the calendar/convert/inbox surfaces keep converging on "capture and shape work exactly where your attention already is," and the move-menu legibility + done-due fix are the kind of small corrections that make the tool feel finished. Banked: Radix's menu `Label` text isn't reliably queryable in jsdom (assert menu section headers in a real-browser e2e, not a unit test); to vet a batch of Dependabot PRs, apply them together on one branch and run the full gate. Next: whatever dogfooding surfaces; NamProduct (the marketing site, a sibling project) got a refresh and has its own page-fix + tutorial-sync (#496) track; still idle — the two agenda tweaks (past-starting ongoing projects in Overdue; scroll-to-today).

## v2.9.0 — 2026-08-01

*(two feature sprints — a second calendar view + convert-with-actions — plus one closed epic and the mandatory-Codex hardening; 4 commits; minor)* **A step up from tweak-sweeps: two genuinely meatier features, both still pure dogfooding.** After a fortnight of small friction-fixes, this cut is two substantial additions that each came straight from using the app. First, a **second calendar view** (#995/#997/#998): a Google-Calendar-mobile-style **agenda/list** beside the classic month grid — a continuous scroll of dated projects + actions, month titles as dividers, Overdue up top, filtered by the usual Next/Backlog/Done boxes. The architecture paid off invisibly here: the calendar was built back in #675 as "a shell around interchangeable views" with the `?view=` param *already reserved*, so the agenda slotted in with zero reshaping — a small vindication of that earlier design instinct. Second, **converting an action to a project now seeds its first actions** (#999/#1000): the user's own insight that "the moment you realize something is a project is when your mind has the sub-actions," so Make-project opens a lean brain-dump for their names — then, on the user's dogfeeding-driven follow-up in the *same* PR, an editable **project name** (copy the original to re-add it as an action, rename the project fresh) and per-row copy/rename/remove. He called it "like good beer." The **mandatory-Codex gate** (made non-optional at the v2.8.0 cut) earned it again on the very next cut: my inline pass was clean, but Codex found **two** real issues — a **stale inline-rename on ⌘Enter** (the rename committed *and* the parent's create() read the pre-commit value, dropping the edit; the mouse path was safe via blur-before-click, but the keyboard shortcut fired in one synchronous event) and **completed items rendered as Overdue** (the agenda partitioned past items by date alone, so enabling Done painted done items with the red overdue warning, against the grid's #868 open-work invariant). Both hardened before release — overdue is now open-only with a neutral "Earlier" group for past-completed. Also this stretch, a **subtraction**: epic **#613** (recurring "bouncing" actions — a doc + design from the Trello-migration era) was **closed won't-do**, because v2.8.0's manual **jump-a-due-date** turned out to cover the real need and the recurrence engine (plus a NamDesktop contract change) would over-complicate — the person who logged the original pain finding the simple thing sufficient after dogfooding it, YAGNI vindicated. **Converging, with taller features** — the "time domain" calendar arc (#438 → grid → agenda) keeps compounding, and convert-with-actions is the kind of capture-in-context convenience that removes a daily two-step. Banked gotchas: React-compiler lint forbids a mutable running var in a render map (compute month-header boundaries by comparing to the previous element); the action editor has its **own** due-editing code separate from the projects' `DueFieldset` (watch for two implementations); workbench Actions/Sub-projects sections collapse by default (e2e needs `expandWorkbench`); and seeded child actions need `atTop:false` or they land in reverse typed order. Next: whatever the next dogfooding day surfaces; the two agenda iteration points the user parked (past-starting ongoing projects in Overdue; scroll-to-today) and the idle `#832/P2` flaky-test stabilization + tutorial-sync (#496) remain.

## v2.8.0 — 2026-08-01

*(two back-to-back dogfooding sprints, seven issues + one pre-cut hardening PR; 8 commits; minor)* **Two rounds of dogfooding, seven everyday surfaces made to fit the hand.** No new domain — this is the pure-polish register, sanding daily friction off across the app, each item a small "I can do it but in two steps when I should finish right here" annoyance closed where the work happens. The **method is now a settled rhythm**: the user dumps a NAM-exported markdown list of gripes, we converge on a concrete issue set in planning (deciding do / split / push / drop per item — this batch: keep Due's status boxes but *fix* the underlying empty-controls bug rather than mask it, and split the "status boxes" gripe into a bug-fix + a Next-removal), then work the whole set straight through as N independent branches → PRs with CF `/demo` links, merge none until the user tests, then cut. The meatiest new capability is **jumping a due date into the future** (#986 — +1 week / month / year / +N years, moving a dated range as a block, calendar-arithmetic simple with month-end clamping), which surfaced a **two-implementation gotcha**: the action editor has its *own* inline due-editing code separate from the `DueFieldset` projects use, so the jump went into both via a shared `jumpDue` helper. Around it: the **Focus** deck promoted **Delete** to a green-Done / red-Delete **pill** (#978 — most cards get binned on completion, not archived; the user was "particularly pleased with the pill"); **Search** rows gained **live project-path links** (#979 — find the action, click through to its project, the actual dogfooding trigger); the project **summary** now includes **Done** by default (#987 — it doubles as sprint input and actions get marked Done once described); the inbox **Process** deck's nav was **aligned to the Focus deck** (#988 — `‹ · Delete · ›` chevrons replacing "Skip", plus a tooltip naming Delete's *dual meaning* in the inbox, "nothing to do, or already handled", a nice articulation of a real mental gap); the **Next** view **shed its status boxes** (#981 — Next is just Next); and **Due** stopped **stranding you** when a filter empties the list (#980 — the early-return dropped the filter controls). The through-line is again the **review**, now made an **explicit mandatory gate** (user, this cut: Codex results come back fast, so there's no reason to ever skip or "trust the inline pass"). It earned that status immediately: my inline pass came back clean-bar-one-stale-test, but **Codex caught a real P2 I missed** — the *same* Due early-return also dropped the **select-toggle + bulk bar**, so a bulk **set-to-Done** that empties the visible rows trapped you in select mode with no way out (the empty-controls bug's selection-controls cousin; #980 fixed filters, this fixes selection — both are read-path-after-mutation traps). Squarely **polishing**, but the compounding kind — the date-jump and live-search-paths are the sort of everyday levers that get used constantly. Recurring operational notes banked: the `GuestSharePage #832/P2` unit test is **reliably CI-flaky** (bit nearly every merge this fortnight; green on re-run, always passes locally — worth a stabilization issue); and parallel PRs each touching `[Unreleased]` collide predictably at merge — resolve + **consolidate the duplicate Added/Changed/Fixed headings in one pass** on the last merge of the train. Next: whatever the next dogfooding day surfaces; still idle — the tutorial-sync routine (#496), and a `#832/P2` test-stabilization.

## v2.7.0 — 2026-07-29

*(a dogfooding cut spanning a hotel-network gap: three feature PRs + a dependency migration + a Dependabot batch, hardened by a four-finding second-vendor review; 8 commits; minor)* **Surface the work in progress — and a filter that has to travel.** The headline is a small, obvious-in-hindsight capability: an **in-progress filter** on every list view (#968) — Next, Backlog, Due, and Contexts each get a chip beside the status include-boxes that narrows to just the `#in-progress` items, shown only when there's something in progress to filter. Conceptually it's the `#in-progress` counterpart to the status boxes, and that framing is exactly what made the review interesting: a *filter* is never just a display predicate — it has to travel consistently through every path that reads the list. The **second-vendor review earned its keep for the Nth straight cut**, finding four order/state-correctness bugs the inline pass and the whole automated gate waved through, all in this one feature: **F1** (#974) — adding while filtered wrote only the *visible* subset to the saved view-order, so clearing the filter stranded the hidden rows at the bottom; **P1-b** (#975) — the same bug's twin on manual reorder (arrow + drag), fixed with a `mergeVisibleOrder` that merges the reordered visible rows back into the full order while hidden rows keep their slots; **P1-a** — clicking **Focus** from a filtered list rebuilt the *full* queue because the predicate never rode the Focus URL (now an `inProgress=1` param applied in `focusCards`); and **P2** — the Tags filter was session state that **leaked across context visits**, silently emptying the next bookmark you opened (now resets alongside `boxOverride` on any fresh landing). The recurring lesson, sharpened again: **derived-state round-trips and filtered write-backs are where the bugs live** — a filter that hides rows must never let a mutation persist only what's visible. Around the headline, two small **converging** wins: bulk **Move** learned to **create a project** on the spot (#970 — the same "new project here" the editor and workbench pickers already had, "both just tree nodes" again), and a README refresh (#969 — the live app link, dropping a stale Focus-dial mention and the NamDesktop *History* section now that NamWeb *is* NAM). Under all of it, a genuinely **modernizing** thread finally landed: **react-router 7 → 8** (#933/#967), which turned out to be a *migration*, not a bump — v8 drops the separate `react-router-dom` package (all 43 import sites move to `react-router`) and requires React 19 (already in use); done on its own tested branch and verified on both browsers once home internet returned (the cut spanned a stretch of hotel Wi-Fi that throttled the ~150 MB Playwright browser downloads — a reminder that the e2e gate needs *both* Chromium and WebKit installed). A Dependabot batch (#954/#955/#956) rode along; TypeScript 6→7 was closed as ecosystem-blocked (typescript-eslint@8 won't peer it). Squarely **dogfooding polish plus one overdue dependency step** — no new domain — but the in-progress filter is the kind of everyday lens that compounds, and its review is a clean case study in "a filter is a contract across every reader, not a view flag." Also banked: install both e2e browsers after any Playwright bump; big binary downloads want a stable network. Next: whatever the next dogfooding day surfaces; still idle — the tutorial-sync routine (#496).

## v2.6.0 — 2026-07-27

*(a layout-control arc: four issues + one review hardening; 8 commits; minor)* **Make the layout yours — and the ruler comes out.** A dogfooding cut whose headline is genuinely new *capability* even though it's still polishing: **Display settings** (#958), giving the user control over the two things that made the desktop feel roomy — a **content-width** cap and a **density** preset (Comfortable/Cozy/Compact) — as presets, not sliders, applied live and persisted per device. The interesting part was the **method**: the user is self-admittedly weak at the UX layer, so we agreed on presets over their sliders instinct, shipped a first cut, and then *tuned it live over three rounds* against real use — including the user measuring the gap between action names **with a physical ruler** (~1.2 cm, "is that a lot?"). That measurement drove the real fix: the row height was set by its **control buttons** (`p-2` ≈ 30px), not the padding I'd been tuning, so "compact" had been shrinking the wrong thing — the controls had to shrink too. Design-by-use, each round a small merged-unreleased PR so the *fuller* thing kept getting dogfooded. Then the **second-vendor review earned its keep yet again** (#964): it caught the reusable row controls (`StatusMenu`, `InProgressToggle`) reading global compact state and **leaking it into non-row hosts** — the calendar day-list and the Focus deck — plus a dead per-list toggle when Compact density was in charge, plus an uncovered phone seam. Fixed by making the controls prop-driven ("hosts decide") and deferring the toggle to density. Around the headline, three small **consistency** wins, each a "these are both just tree nodes / both just surfaces" argument: the confusing focus-bookmark **▾ dial** left the toolbar (#950 — enter Focus from a list you can see first), the project **explorer** learned to scroll a long nested path + tooltip it (#951), and a sub-project's quick-move gained **"level up"** to match actions (#962). Squarely **polishing** — no new domain — but the density presets are the kind of user-control substrate that compounds. Also banked: the shared-vs-bespoke control trap (reusable controls must not read global row state) and the prefer-a-recommendation-over-a-menu working style for light UX calls. Next: whatever the next dogfooding day surfaces; still idle — react-router 7→8 (#933), tutorial-sync (#496).

## v2.5.0 — 2026-07-25

*(a ~1-day friction sprint: six feature/fix PRs + one cut-review hardening; 9 commits; minor)* **Finish where you are — and the second vendor earns its keep, twice running.** Another dogfooding-driven sprint of the same shape as v2.4.0: six small "I can do it, but in two steps when I should finish right here" annoyances, each closed where the work happens, none expanding NAM's scope — squarely **converging/polishing**. The set: inbox **Process selected** now opens as a **centered dialog** instead of inline above a scrolled list (it was rendering off-screen above the fold — a real new-user trap, #935); bulk **Tag/Set-status keep the selection** so you can chain ops without reselecting, in the list views *and* on a project's actions (#936); a **chevron peek** to read a long description in a popover without opening the item (#940 — first built as an expandable hover tooltip, abandoned when Radix's ephemeral content proved un-clickable; a Popover is the right primitive for interactive peek); **Loose ends** lists **unused tags** for one-click cleanup (#939); a deleted-project **bookmark** is finally removable from the Focus dial (#937); and **Help** got a sidebar home (#938 — I'd missed it myself, tucked in the avatar menu). The through-line, again, is the **cut review**: my inline pass came back clean, but the second-vendor Codex pass found **two real bugs I'd actively waved through** (#947) — the workbench keep-selection reopened the very off-screen-mutation hazard the *previous* sprint's review had closed on the shared bar (the workbench filters actions by status boxes; I'd wrongly claimed it shows all statuses), and an "unused" tag could still back a **saved view / tag-filter bookmark** that `deleteTag` would silently destroy (I'd only checked node tags). **Two consecutive cuts where Codex caught a correctness bug an inline pass missed** — the pattern is now explicit ritual, not experiment. The recurring lesson sharpened: my inline "looked safe" claims about **bespoke, lightly-exercised surfaces** (Search last time, the workbench this time) are exactly where the second lens pays off — trace the *actual* guard/filter, don't assert from memory. Also banked: the shared vs bespoke bulk-select split (Inbox/Done/workbench each roll their own) means a cross-cutting change to the shared bar silently misses them. Next: react-router **7→8** (Dependabot #933, own tested branch), the tutorial-sync routine (#496), and whatever the next dogfooding day turns up.

## v2.4.0 — 2026-07-25

*(a ~1-day friction sprint: three feature/fix PRs + a dependency sweep + two cut-review hardenings; 18 commits; minor)* **Work in bulk, tag as you clarify — and a review that earned its keep on a cold surface.** A tight sprint from a day of heavy dogfooding, aimed squarely at the "I can get what I want, but in two steps when I should finish where I am" class of friction. Two closes: **tag-while-processing** (#920 — classify an item, or a batch, *during* clarification, on the deck, the batch wizard, and capture, instead of reopening the editor) and **multi-select + bulk actions across every list view** (#921, two parts — Next/Backlog/Due/Contexts, then Blocked/Search — tag/status/move/delete a whole selection from one shared bar). Both **converging**: no new domain, just deepening capture/clarify/engage ergonomics. Alongside the features, a **backlog reckoning** — the 14 stale open PRs were triaged down to a clean 3, merging a dependency refresh (react-router **6→7** #926/#927, the prod/dev bump groups, CI actions) and closing the superseded/obsolete ones. The sprint's real story is the **cut review**. My inline pass came back "clean bar one low UX wart" (an exit-toggle that vanished on an emptied list, #928); the second-vendor Codex pass then found **two real P1s** in the brand-new bulk-select code that I had *actively mis-judged* — a stale selection acting on **off-screen** nodes (I'd called it cosmetic; it's a real off-screen delete) and Search's mixed action+project selection **misplacing a project** via bulk move (I'd claimed `moveNode` blocked it; `structuralIds` is only the four system containers, so a user project is fully movable). Both fixed with an intersect-at-the-choke-point guard and action-only Search selection (#930). The lesson the user named and worth keeping: **review catches correctness bugs on lightly-dogfooded surfaces** (Search is a rich feature they rarely use) that usage will never surface — a diff-review doesn't care how much a feature is exercised. Point reviews at the rich-but-rarely-touched corners. Next: the selection-preserve tweak (keep the pick after tag/status) heads a fresh friction sprint.

## v2.3.0 — 2026-07-24

*(five PRs — one new-feature sprint, three dogfooding nudges, one review-hardening; 1 release; minor)* **The Reflect phase arrives.** NAM had four of GTD's five pillars; the fifth — *reflect*, the weekly-review step people skip and then feel they've failed the whole system — was the hole. This fills it with **"Loose ends"**: an always-on status overview (stalled projects · gone-quiet actions · Inbox/Overdue/Blocked counts), deliberately **not** a scheduled ritual and **anti-guilt by construction** (no streaks, no score). Squarely a **converging** cut — a missing pillar, not polish — and the first surface of the Review epic banked in the design doc (#891). The story is the *method*: sprint-1 (#906) shipped a deliberately minimal surface, then a single day of dogfooding **on real data** shaped it in real time through three nudges — `#not-stalled` to exclude intentionally next-less projects (#909), tree (DFS) order + ancestor paths so nested stalled projects read in context (#911), and copy + inline rename on the rows (#913). Design-by-use, each nudge a small PR merged unreleased so the *fuller* thing kept getting dogfooded. The dual review earned its keep again with a clean zero-overlap split: my inline pass came back clean (one low UX note), and real Codex found **four disjoint issues** the inline pass missed — a blocked-NEXT action making a project look healthy (a divergence from my own design's "unblocked" wording), the surface unreachable on phone (`MORE_GROUPS` forgotten), a double-counting blocked tally, and a boundary off-by-one — all fixed in #915. Also a process correction banked mid-arc: `/ultrareview` is a paid *Claude* review, not the second-vendor Codex; recalibrated to inline-by-default, real-Codex for cuts. The tag layer (`#in-progress`, `#not-stalled`) is quietly becoming the substrate the future AI amplifier will read. Next: the rest of the Review arc (the `#in-progress` "left hanging" lens, then the sweep deck) and a batch of friction/tweak issues from real use.

## v2.2.0 — 2026-07-23

*(the v2.1.0→v2.2.0 second half: five tweak PRs + a design note + two hotfix patches + one review-hardening; 3 releases — two patches then this minor)* **Dogfooding polish, round two — with a process reckoning.** The features are more of the same good kind: use the thing, note what chafes, fix it. Five small frictions — the toolbar logo shoved to the far right (out of the sidebar toggle's way), a copyable version on the Account page, in-progress rows tinted amber, calendar day-rows given rename + status, and items created away from a list (action⇄project converts) landing at the **top** instead of the bottom. Squarely **polishing**. Two threads make it interesting. First, an **input-robustness saga**: the inbox-deck arrow keys (shipped in 2.1.0) worked on one Mac and not another — a `DialogContent` handler that only fires with focus inside, then a window listener on the *bubble* phase that still lost to the browser's focus-nav, finally a window listener on the **capture** phase (2.1.1 → 2.1.2, two hotfix patches). The reusable lesson: for keyboard shortcuts that must fire regardless of focus inside a Radix dialog, use a capture-phase window listener — bubble and content-scoped both fail. Second, a **review-workflow correction**: the user caught me mislabeling `/ultrareview` as "Codex" — it's a paid *Claude* cloud review, not the second-vendor Codex we'd historically paired with the inline Claude pass. Recalibrated to: inline Claude review by default, `/ultrareview` reserved for big/risky diffs or expiring tokens, real Codex as the steady second opinion. And a genuine miss surfaced the discipline point — the cloud pass caught that #894's "lands first" was a no-op for `/next` (which orders by `viewOrders.next`, not childIds); my inline pass had checked the *write* (childIds) without tracing the *read* path. Fixed (#902) and confirmed clean by real Codex. The design note for the **Review** feature (the always-on GTD status overview) also landed this stretch — the next arc's spec is banked. Next: the Review-fx sprint.

## v2.1.0 — 2026-07-22

*(nine PRs — one feature, five dogfooding tweaks, two review-hardenings, the cut; 1 release; minor)*
**The first dogfooding pass after the milestone.** With 2.0 shipped, the work turned inward: use the
thing, write down what chafes, fix it. One change carried real domain weight — **templates grew up**
(#863/#864): saving a project as a template had been title-only and effectively useless, so it now
captures the whole subtree (tags, due dates/times, resources, descriptions, prerequisites, and
internal action-links) and reproduces it with fresh ids on a one-click new project, every action
landing as Next so the result reads as a draft to review. Around it, a sweep of small frictions from a
NAM-exported dogfooding plan: calendar **Show done** (#868), the inbox focus-deck **cycling from the
keyboard** with an "X of N" readout (#866), convert-action **opening the new project** (#867), the
**logo moving to the toolbar** to reclaim a sidebar row (#870), and a quiet **current-view label** on
the look-alike list surfaces (#869). So squarely a **polishing** cut — no new epic, just sharpening
what 2.0 left rough, driven by actual use rather than a roadmap. Two process notes. First, the dual
review **converged** this time: Claude and Codex independently landed on the *same* single real bug —
template action-links weren't remapped like `blockedBy` (#876) — where past cuts found disjoint bugs;
convergence-on-one is itself a signal the change was small and clean (two Claude-only lows followed: a
redundant calendar label, fixed as #878; a transient deck-arrow discard, accepted). Second, the
merge-train mechanics bit — five independent branches all writing the same `[Unreleased]` CHANGELOG
spot re-conflicted each other on every merge, so the tail PRs needed re-resolving after each landing.
Next: keep dogfooding the shared surface and this template flow now that they're real; the roadmap
still opens toward guest-page polish and, further out, AI-via-MCP on the web.

## v2.0.0 — 2026-07-21

*(four PRs — two features, a review-hardening, the cut; 1 release; a milestone major)* **The unveil.**
Project sharing — projects as guest-friendly web pages via a secret link, guests never becoming users —
leaves Labs and goes public, and NamWeb crosses to **2.0**. The code this sprint was deliberately
small: remove two `!labs` gates and a "(Labs)" tooltip (#858), then add a read-only Shared view + a
share badge on the projects list so it's easy to find what you've published (#859). The *weight* was
the arc behind it — the epic has been building dark since #759 through the sanitizer security boundary,
guest-interactive counters and questions, the from-guests suggestion tray, and last-and-hardest the
v1.12.1 concurrent-drain fix that took seven review rounds to make multi-device-safe. So this is an
emphatically **converging** cut: not new surface area but a threshold crossed, the banked milestone
finally spent. Process-wise it validated *calibrated* review depth — a single independent Claude pass
(not the full dual dance) for a UI-only diff, which correctly returned SAFE-TO-CUT with only low
findings (the sharpest: the offline demo had begun making a spurious backend call), folded in before
the tag. The versioning is a deliberate milestone major, not a breaking one — 2.0 names the capability,
not a contract break. Next: the shared surface earns real dogfooding now that it's live; the roadmap
opens toward guest-page polish and, further out, AI-via-MCP on the web.

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
