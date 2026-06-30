// Declarative catalog of the NamProduct "learn nam" tutorials, generated from NamWeb's demo
// workspace. This is the single source of truth the tutorial-sync routine reads (see
// docs/features/tutorial-sync/design.md): the staleness mapper uses each tutorial's `surfaces` to
// decide which tutorials a NamWeb change touched, the capture harness drives the demo to produce its
// screenshots, and the slideshow assembler pairs each `slide` caption with the captured image.
//
// It is tooling metadata, not app code — nothing in the app imports it, so it is never bundled. It
// lives under src/ only so the existing gates cover it for free (typechecked via tsconfig
// `include: ["src"]`, unit-tested via vitest `src/**`).

export type Viewport = 'desktop' | 'phone';

/** One slide of a tutorial: a screenshot (by slug) plus the caption shown beneath it. */
export interface TutorialSlide {
  /** Filename-safe slug; the capture harness writes `<id>/<viewport>/NN-<shot>.png` for it. */
  shot: string;
  /** The caption rendered with the slide. */
  caption: string;
}

export interface Tutorial {
  /** Stable id; also the output directory name. */
  id: string;
  /** Human title, e.g. "How to process items in the inbox". */
  title: string;
  /** Which viewports to capture. */
  viewports: Viewport[];
  /**
   * The UI surfaces this tutorial depends on, as a mix of:
   *  • source-path globs (`*` = one path segment, `**` = any depth) matched against the files
   *    changed since `.tutorials-synced`, and
   *  • lowercase keywords matched against the CHANGELOG `[Unreleased]` text.
   * A change touching any entry flags the tutorial as possibly stale. The mapper proposes; a human
   * (the /refresh-tutorials skill run) confirms — keywords are intentionally loose.
   */
  surfaces: string[];
  /** Ordered slides; each `shot` must be produced by the capture harness in the same order. */
  slides: TutorialSlide[];
}

export const tutorials: Tutorial[] = [
  {
    id: 'process-inbox',
    title: 'How to process items in the inbox',
    viewports: ['desktop', 'phone'],
    surfaces: [
      'src/**/Inbox*',
      'src/**/inbox*',
      'src/**/Clarify*',
      'src/**/clarify*',
      'inbox',
      'triage',
      'clarify',
      'capture',
      'process',
    ],
    slides: [
      { shot: 'inbox-overview', caption: 'Everything you capture lands in the Inbox — one place to empty your head.' },
      { shot: 'process-open', caption: 'Pick an item and choose Process to clarify what it really is.' },
      { shot: 'clarify-action', caption: 'Decide its shape — here it is a single next action.' },
      { shot: 'landed-in-next', caption: 'Send it onward and it leaves the Inbox for your Next list, ready to do.' },
    ],
  },
];
