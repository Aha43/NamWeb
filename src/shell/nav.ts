import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Folders,
  Gauge,
  Inbox,
  LayoutDashboard,
  Layers,
  ListTodo,
  Lock,
  Copy,
  Search,
  Share2,
  Tag,
  Target,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  /** i18n key for the surface label (translated at the render site). */
  label: string;
  icon: LucideIcon;
  /** i18n key for the short tooltip/subtitle describing the surface. */
  hint?: string;
  /** The surface renders its own prominent heading (e.g. the calendar's month/day title), so it
   *  skips the shell's current-view label (#878) — that label is for the look-alike list surfaces. */
  selfTitled?: boolean;
}

// Labels are i18n keys; the surface names live under `domain.*` (shareable vocab), hints under `nav.*`.
const inbox: NavItem = { to: '/inbox', label: 'domain.inbox', icon: Inbox, hint: 'nav.inboxHint' };
// "Loose ends" (#906): the always-on status overview. selfTitled — the page has its own heading, so
// it opts out of the shell's current-view label (#878).
const looseEnds: NavItem = { to: '/loose-ends', label: 'domain.looseEnds', icon: Gauge, hint: 'nav.looseEndsHint', selfTitled: true };
export const next: NavItem = { to: '/next', label: 'domain.status.next', icon: ListTodo, hint: 'nav.nextHint' };
const backlog: NavItem = { to: '/backlog', label: 'domain.status.backlog', icon: Layers, hint: 'nav.backlogHint' };
const due: NavItem = { to: '/due', label: 'domain.due', icon: CalendarClock, hint: 'nav.dueHint' };
export const calendar: NavItem = { to: '/calendar', label: 'domain.calendar', icon: CalendarDays, hint: 'nav.calendarHint', selfTitled: true };
const blocked: NavItem = { to: '/blocked', label: 'domain.blocked', icon: Lock, hint: 'nav.blockedHint' };
export const tags: NavItem = { to: '/tags', label: 'domain.tags', icon: Tag, hint: 'nav.tagsHint' };
const search: NavItem = { to: '/search', label: 'domain.search', icon: Search, hint: 'nav.searchHint' };
export const projects: NavItem = { to: '/projects', label: 'domain.projects', icon: Folders, hint: 'nav.projectsHint' };
const goals: NavItem = { to: '/goals', label: 'domain.goals', icon: LayoutDashboard, hint: 'nav.goalsHint' };
const templates: NavItem = { to: '/templates', label: 'domain.templates', icon: Copy, hint: 'nav.templatesHint' };
// "Shared" is a NamWeb-only surface (published project links), so its label is a plain nav key, not
// part of the NamDesktop-shared domain vocab.
const shared: NavItem = { to: '/shared', label: 'shared.title', icon: Share2, hint: 'nav.sharedHint' };
const done: NavItem = { to: '/done', label: 'domain.status.done', icon: CheckCircle2, hint: 'nav.doneHint' };
export const focus: NavItem = { to: '/focus', label: 'domain.focus', icon: Target, hint: 'nav.focusHint' };

/** All routable surfaces, flat — the phone bottom bar foregrounds a subset (capture + execution) and
 *  the rest live in the More sheet. */
export const SURFACES: NavItem[] = [
  inbox, looseEnds, next, backlog, due, calendar, blocked, tags, search, projects, goals, templates, shared, done, focus,
];

export interface NavGroup {
  /** Optional small section heading. */
  label?: string;
  items: NavItem[];
}

/** Desktop sidebar. The foregrounded actions — Capture, Next, Contexts (tags), Focus, and
 *  Projects — live in the toolbar command bar (#590, see DesktopShell), so they're not repeated
 *  here. The list is short enough to scan whole now, so groups keep their spacing but drop the
 *  "Views"/"Organize" headings (things are what they are); the phone More sheet keeps its own. */
export const SIDEBAR_GROUPS: NavGroup[] = [
  { items: [inbox, looseEnds] },
  // Calendar lives in the toolbar command bar too (#763) — one home is enough on desktop;
  // the phone More sheet keeps it (no toolbar there).
  { items: [backlog, due, blocked, done] },
  { items: [goals, templates, shared] },
];

/** Phone "More" sheet: the surfaces that aren't on the bottom bar (Inbox / Next / Focus + Capture),
 *  grouped, and rendered with their `hint` as a subtitle — tooltips don't fire on touch, so this is
 *  how the per-surface descriptions reach mobile. Tags + Search live here too (no toolbar on phone). */
export const MORE_GROUPS: NavGroup[] = [
  { label: 'nav.groupViews', items: [backlog, due, calendar, blocked, done] },
  { label: 'nav.groupOrganize', items: [projects, goals, templates, shared] },
  { label: 'nav.groupFind', items: [tags, search] },
];
