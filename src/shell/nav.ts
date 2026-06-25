import {
  CalendarClock,
  CheckCircle2,
  Folders,
  Inbox,
  LayoutDashboard,
  Layers,
  ListTodo,
  Lock,
  Copy,
  Search,
  Tag,
  Target,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Short tooltip describing the surface (the sidebar label is already shown, so this adds value). */
  hint?: string;
}

const inbox: NavItem = { to: '/inbox', label: 'Inbox', icon: Inbox, hint: 'Capture and triage' };
const next: NavItem = { to: '/next', label: 'Next', icon: ListTodo, hint: 'Your next actions' };
const backlog: NavItem = { to: '/backlog', label: 'Backlog', icon: Layers, hint: 'Parked for later' };
const due: NavItem = { to: '/due', label: 'Due', icon: CalendarClock, hint: 'Grouped by due date' };
const blocked: NavItem = { to: '/blocked', label: 'Blocked', icon: Lock, hint: 'Waiting on prerequisites' };
const tags: NavItem = { to: '/tags', label: 'Tags', icon: Tag, hint: 'Filter by tag · manage tags' };
const search: NavItem = { to: '/search', label: 'Search', icon: Search, hint: 'Search your workspace' };
const projects: NavItem = { to: '/projects', label: 'Projects', icon: Folders, hint: 'Your project hierarchy' };
const goals: NavItem = { to: '/goals', label: 'Goals', icon: LayoutDashboard, hint: 'Goal boards (Mission Control)' };
const templates: NavItem = { to: '/templates', label: 'Templates', icon: Copy, hint: 'Reusable project templates' };
const done: NavItem = { to: '/done', label: 'Done', icon: CheckCircle2, hint: 'Completed actions' };
export const focus: NavItem = { to: '/focus', label: 'Focus', icon: Target, hint: 'Work through actions one at a time' };

/** All routable surfaces, flat — the phone bottom bar foregrounds a subset (capture + execution) and
 *  the rest live in the More sheet. */
export const SURFACES: NavItem[] = [
  inbox, next, backlog, due, blocked, tags, search, projects, goals, templates, done, focus,
];

export interface NavGroup {
  /** Optional small section heading. */
  label?: string;
  items: NavItem[];
}

/** Desktop sidebar, grouped so the eye gets short sections instead of one long list. **Capture** and
 *  **Focus** are promoted to buttons above the list (the two "do" actions, mirroring the phone), and
 *  **Search** lives in the toolbar. **Tags** sits here under "Find" — with bookmarking owning
 *  quick-jump, Tags' filtering role is what matters, so it belongs with the surfaces. */
export const SIDEBAR_GROUPS: NavGroup[] = [
  { items: [inbox, next] },
  { label: 'Views', items: [backlog, due, blocked, done] },
  { label: 'Organize', items: [projects, goals, templates] },
  { label: 'Find', items: [tags] },
];

/** Phone "More" sheet: the surfaces that aren't on the bottom bar (Inbox / Next / Focus + Capture),
 *  grouped, and rendered with their `hint` as a subtitle — tooltips don't fire on touch, so this is
 *  how the per-surface descriptions reach mobile. Tags + Search live here too (no toolbar on phone). */
export const MORE_GROUPS: NavGroup[] = [
  { label: 'Views', items: [backlog, due, blocked, done] },
  { label: 'Organize', items: [projects, goals, templates] },
  { label: 'Find', items: [tags, search] },
];
