# Changelog

All notable changes to NamWeb are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added

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
