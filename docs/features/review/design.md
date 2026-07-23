# Review — always-on status overview — design

> Status: **planning / not started.** Handoff doc from the planning chat (2026-07-23). Design only —
> no implementation until the direction and first-sprint scope are signed off. Closes the design part
> of #890.

## Why this exists

NAM covers four of GTD's five phases and has a hole in the fifth:

| Phase | NAM surface |
| --- | --- |
| Capture | Inbox, quick-add |
| Clarify | Process wizard / inbox deck |
| Organize | Projects, tags/contexts, due, Blocked |
| Engage | Next, Focus decks, Calendar |
| **Reflect (Review)** | **— nothing dedicated —** |

The Reflect phase is where GTD famously breaks down for people: the **weekly review is the step
most users skip**, and skipping it makes them feel they've failed *the whole system*, so they bounce
off GTD entirely. The gap isn't that people can't review — every surface needed to review already
exists — it's that nothing **surfaces what needs attention** or makes "how are things?" a low-effort
glance.

So the goal is not to add a *ritual*. It's to make **checking the status of your stuff trivially easy,
anytime** — three times a day if that's the rhythm right now. When looking is a glance, you can't fall
behind on it, and the guilt that kills GTD adoption never forms.

## The Nam\* principle this is built on

The Nam\* thesis: **a production system that makes GTD-as-Allen-describes-it easy will be a good
system even for people who've never heard of GTD.** A GTD reader should think *"oh — this makes the
weekly review easy."* Everyone else should just think *"checking the status of my stuff is easy in
this app."* Same feature, two readings, no jargon imposed on anyone.

NAM already does this: **"Blocked"** not "Waiting For," **"Backlog"** not "Someday/Maybe." Review
follows the same rule.

Three hard constraints fall out, and they gate every decision below:

1. **GTD-faithful underneath, never GTD-prescriptive on the surface.** No "Weekly Review" label, no
   methodology lecture. The mechanics make Allen's loop fall out; the words stay plain.
2. **Capability, not cadence.** Always available, usable any number of times a day. Never a mode you
   can *only* enter on a schedule, never anything that pushes a weekly (or any) rhythm.
3. **Anti-guilt — the feature must never keep score.** No streaks, no "not reviewed in N days," no
   completion state to fall short of, no "you're behind." The instant it keeps score it recreates the
   exact failure it exists to dissolve. **It is a window, not a chore.** This one is load-bearing —
   any feature idea that reintroduces scoring is out, however friendly it looks.

## The model in one paragraph

An **always-available overview surface** that composes a handful of deterministic **"mess" lenses** —
pure, instant views of things that have quietly gone sideways: projects with nothing to do next,
items that have gone quiet, work left hanging mid-flight. You open it whenever you want a read on
where things stand; it shows the state, never a grade. From it you can drill into any item, or pick
up an optional **sweep** (the Focus-deck UI aimed at the attention set) to work through things
one-by-one — but sweeping is a tool you reach for, never a ritual you're pushed into.

## The "mess" lenses (the substance)

Deterministic, pure functions over the workspace doc — the durable substrate. Each answers one plain
question. Definitions are first-draft and open for refinement.

- **Stalled projects — "nothing to do next."** An open, non-archived project whose subtree contains
  **no open, unblocked `NEXT` action** — i.e. nothing you could actually pick up. This is the
  canonical GTD review output ("every project needs a next action") in plain language. *(Edge: a
  container project whose sub-projects each have next actions is *not* stalled — evaluate over the
  whole subtree. Decide whether a project with only `BACKLOG`/blocked actions counts as stalled — lean
  yes: there's nothing actionable.)*
- **Gone quiet — "haven't touched this in a while."** An open action or project whose
  `statusChangedAt` (fallback `updatedAt`) is older than a threshold. Threshold has a sensible default
  and is adjustable **in the view** (not a setting to configure up front). Framed as "quiet," never
  "neglected."
- **Left hanging — "started and didn't finish."** Nodes carrying the `#in-progress` system tag,
  optionally weighted toward those whose `statusChangedAt` is old. The things you're mid-way on.

Candidates to *reference* (not re-implement) in the overview, since surfaces already exist:

- **Inbox not empty** (get clear) → link to Inbox.
- **Overdue / due soon** → the Calendar/Due surfaces already own this; the overview summarizes a count
  and links out.
- **Blocked / waiting** → the Blocked surface already exists; summarize a count and link out.

The overview's job is composition + drill-in + an at-a-glance read, not to duplicate existing views.

## Scope

### In (the first sprint — lenses + a plain overview)

- The **stalled** and **gone-quiet** lenses as pure domain functions (start with two; `#in-progress`
  can be the third or a fast-follow).
- **One overview surface** that shows each lens as a small, drill-innable group with counts, plus
  reference counts (inbox / overdue / blocked) that link to their existing homes.
- Zero cadence, zero scoring, plain-language copy. A name that reads as status, not ritual.

### Out (later / explicitly not now)

- Any **scheduled review mode**, "start your weekly review" entry point, progress bar, or "mark review
  complete." (Violates constraints 2 + 3.)
- Any **cadence nudge / last-reviewed timestamp / streak**. (Violates constraint 3.) *We may store a
  last-touched fact for the quiet lens, but it drives no nag.*
- **AI** anything (see below — it's a later amplifier, deliberately sequenced after the lenses).
- The **sweep deck** over the attention set — desirable, but a fast-follow once the lenses + overview
  prove out; it reuses Focus-deck machinery so it's cheap to add later.

## How it fits the architecture

- **Lenses live in the domain layer** (`src/domain/lenses.ts` or a new `src/domain/review.ts`),
  pure over `WorkspaceDocument`, unit-tested in isolation — same shape as the calendar read model
  (`src/domain/calendar.ts`). They use fields that already exist: `status`, `project`, `childIds`,
  `blockedBy`, `statusChangedAt`/`updatedAt`, the `#in-progress` tag. **No doc-format change expected**
  for the first sprint (nothing new to persist), so **no NamDesktop contract touch** — a plus.
- **The overview surface** is a routed view. Worth checking whether the existing `missionControls`
  concept in the workspace doc is the natural home or precedent before adding a brand-new surface.
- **The sweep** (later) is the existing Focus-deck immersive UI pointed at the attention set — the
  keyboard flow comes for free (now that the deck arrows actually work: #885).

## Naming direction

Avoid **"Weekly Review"** in the UI — it dates the feature and prescribes a cadence, breaking
constraints 1–2. Candidates that read as status to everyone and as review to GTD folks: **"Loose
ends," "Needs attention," "Check-in," "Overview," "How things stand."** Decide during the sprint;
lean toward the plainest.

## AI is a later amplifier, not the substrate

The user's read (endorsed): **AI will help a lot here — but views showing you the mess will always be
useful on their own.** Sequencing matters:

- The **lenses are the durable substrate**: deterministic, instant, offline, trustworthy. You never
  need a model to answer "which projects have no next action." They ship first and stand alone.
- **AI is an amplifier layered on later** (the MCP-on-web / 2.0+ track): it reads the *same* computed
  signals and adds judgment — "these three stalled projects actually matter this week; that one's fine
  to ignore," or a plain-language "here's how things stand."
- **Design consequence now:** shape the lenses as clean, structured, queryable signals (typed lists of
  nodes + why-flagged), so a future MCP tool consumes them directly. Build the views for humans; get
  the AI input surface for free.

## Alternatives considered (and why they're out)

- **A guided Weekly Review mode with progress + "mark complete."** Rejected: it's the ritual users
  already fail; scoring recreates the guilt (constraint 3). The *guided sweep* survives as an optional
  anytime tool — minus any completion/ritual framing.
- **A "you haven't reviewed in N days" nudge.** Rejected outright: cadence-enforcement wearing a
  friendly face (constraints 2 + 3).
- **Streaks / review score / health grade.** Rejected: keeping score is the anti-pattern.
- **Leaning on AI first.** Rejected as *sequencing*: the deterministic mess-views are more valuable and
  more trustworthy day-to-day, and they're what the AI later builds on.

## Open questions

1. **Stalled definition edge:** does a project with only `BACKLOG` or only blocked actions count as
   stalled? (Lean: yes — nothing actionable = stalled.) And how to treat pure container projects whose
   sub-projects are healthy (evaluate over the full subtree — settled, but confirm).
2. **"Gone quiet" default threshold** and whether it's per-lens-adjustable in the view vs a fixed
   sensible default to start.
3. **Home for the overview:** new routed surface, or built on `missionControls`? (Investigate the
   existing concept first.)
4. **Naming** (see above).
5. **How much to summarize-vs-link** for inbox/overdue/blocked — counts + links only, or light inline
   lists?

## Suggested first sprint (after sign-off — not started)

1. Domain: `stalledProjects()` + `goneQuiet()` lenses (pure, unit-tested), typed to double as the
   future AI/MCP signal.
2. One plain **overview surface** composing them with counts + drill-in, plus reference counts
   (inbox/overdue/blocked) linking to existing homes. Plain name, no cadence, no scoring.
3. Wire it into nav; demo-workspace seed covers a stalled + a quiet item so the CF preview shows it.

Fast-follows (own sprints): `#in-progress` "left hanging" lens · the **sweep deck** over the attention
set · then — much later, its own track — the **AI amplifier** via MCP over the same signals.
