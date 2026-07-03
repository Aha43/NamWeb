# Recurring ("bouncing") actions — design

> Status: **Contract locked (2026-07-03) — desktop leads.** Originally brewing from a planning
> conversation; the NamDesktop handover then ran in reverse: desktop implemented first
> (`Aha43/NamDesktop#427`, mirroring epic #613), which locked the contract below. Web now
> implements against it. The Trello migration motivated it: Trello cards that get "bumped
> forward" by hand every time they're done.

## Contract (locked 2026-07-03, per Aha43/NamDesktop#427)

The document fields are exactly the sketch below, plus these decisions — both apps must match:

- **Field shape.** Optional `recurrence` (`kind`/`days`/`unit`/`every`/`day`/`weekend`) and
  `lastCompletedAt` (ISO date) on the node. **Absent = not recurring** — writers keep the fields
  off the wire for non-recurring nodes (not `null`).
- **Return-to status: keep the current status** (open question 2 resolved). Completing a
  recurring action never changes `status` — a NEXT card stays NEXT, a BACKLOG-dwelling yearly
  duty stays BACKLOG. No extra field; the "remember pre-Done status" case falls out for free.
- **Bounce semantics.** On complete: `lastCompletedAt = today`, `dueAt = next(rule)`.
  `afterDone`: next = completion date + `days`. `calendar` (unit `month`, v1): next = first slot
  strictly after the **current due date** (anchor stability — never the completion date); clamp
  `day` to the month's last day first, then apply the `weekend` rule (`before` → Friday,
  `after` → Monday); if the adjusted slot isn't strictly after the due date, take the next
  period's slot.
- **Forward tolerance.** A reader that can't compute a rule (unknown `kind`/`unit`) must keep
  the field intact and complete as a plain DONE — never drop or rewrite a foreign rule. Editors
  must not silently wipe a rule they can't represent.
- **v1 scope.** `unit: "month"` only; recurring projects, weekly unit, and holiday landing rules
  are out (open questions 1 and 5 deferred).
- Desktop reference implementation: `RecurrenceRule` + `Recurrence` in NamDesktop
  (`src/namdesktop/model/`), covered by `RecurrenceRuleTest` (anchor stability, clamping,
  weekend rules, forward tolerance).

## The idea: one card that bounces, not recurring copies

A recurring duty is **one action** that, when completed, immediately becomes *not done again at a
later date*. The same node persists — identity, title, notes, tags — so:

1. **No clutter.** There is only ever the *next* occurrence. No pre-generated series, nothing to
   sweep up, nothing scheduled into a future you'll reorganize anyway.
2. **Variation is free.** Editing the card edits "all future occurrences", because there are no
   other occurrences. The payday routine's contents drift over the years (bills die, investment
   strategy changes) — the card just drifts with them.

This is deliberately **not** "auto-generate instances ahead" (rejected: clutter, and the generated
copies fossilize content at generation time).

## Two kinds of "forward" (from the motivating examples)

**A. Completion-anchored ("after done")** — the transit ticket. Next due = *the day you actually
did it* + N days. Expired Friday, renewed Monday → still a full 30 days from Monday. The variation
in when you complete it is the point.

**B. Calendar-anchored ("landing slot")** — payday. Next due = the next calendar slot (the 15th
monthly), independent of when you completed the previous one. Two sub-rules the real world forces:

- **Landing rules:** slot falls on a weekend → adjust (payday: preceding Friday). Slot day doesn't
  exist (31st in April, 29–31 in February) → clamp to the month's last day *first*, then apply the
  weekend adjustment.
- **Anchor stability:** completing early (the 13th) or late (the 17th) must not shift the series.
  Calendar mode therefore advances from the **current due date**, never the completion date:
  next = first slot strictly after the current due. (After-done mode is the opposite by design.)

## Sketch: the document field (shared contract)

```jsonc
// On NamNode, optional — absent means "not recurring" (back-compat by omission):
"recurrence": {
  "kind": "afterDone" | "calendar",
  // afterDone: bounce this many days past the completion date.
  "days": 30,
  // calendar: every N units landing on `day` (unit 'month' first; 'week' later if wanted).
  "unit": "month", "every": 1, "day": 15,
  // landing rule when the (clamped) slot hits Sat/Sun.
  "weekend": "none" | "before" | "after"
},
"lastCompletedAt": "2026-07-15"   // optional; feeds "how long since" + future streaks
```

## Behavior sketch (web)

- **Completing a recurring action does not leave it Done.** One intent (e.g. `completeRecurring`)
  applies: `lastCompletedAt = today`, `dueAt = next(rule)`, status back to **NEXT** (open
  question 2). Computed values ride on the intent (like `now`/ids everywhere else) so sync
  conflict-replay stays deterministic.
- **Undo toast** (the #567 machinery): *"Done — comes back 15 Aug"* with Undo restoring the prior
  due/status. This also softens the "it didn't go to Done?" surprise.
- **Editor:** a "Repeats" section, progressive-disclosure like the time/range section (#559):
  off / after-done (N days) / monthly (day + weekend rule).
- **Rows:** a small ↻ marker next to the due hint; Due view shows recurring items naturally.

## Open questions (settle at planning time)

1. **The paycheck *list*.** It's really a recurring **project** (a checklist that resets: all child
   actions back to NEXT + project bounces). Phase 2? Or is phase 1's answer "a recurring action
   whose sub-steps live in its notes" good enough to start?
2. ~~**Return-to status:** always NEXT, or remember the pre-Done status?~~ **Resolved: keep the
   current status** (see Contract) — handles BACKLOG-dwelling duties with no extra field.
3. **Does Done-for-a-moment show anywhere?** (Focus deck: completing a recurring card should feel
   like completing — animation out — even though it never lands in the Done view.)
4. ~~**NamDesktop handover** (blocking, like #438)~~ **Resolved — inverted: desktop led.**
   Desktop round-trips the fields losslessly (desktop #416 test) *and* implements the full bounce
   (`Aha43/NamDesktop#427`). Web mirrors against the locked Contract above.
5. **Landing rules beyond weekends?** (Holidays are a rabbit hole — explicitly out of scope for v1.)
6. **Import:** the Trello migration (docs/features/trello-migration) could mark known bouncing
   cards as recurring on the way in.

## Why this beats Trello here

Trello gives the *bump* no help: you re-date by hand, remember the landing rules in your head, and
the card's date silently goes stale if you forget. Here the rule is data on the card: completion
computes the next landing, weekend/short-month rules apply themselves, and the card is always
honest about when it's due back.
