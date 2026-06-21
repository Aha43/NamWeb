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
}

const inbox: NavItem = { to: '/inbox', label: 'Inbox', icon: Inbox };
const next: NavItem = { to: '/next', label: 'Next', icon: ListTodo };
const backlog: NavItem = { to: '/backlog', label: 'Backlog', icon: Layers };
const due: NavItem = { to: '/due', label: 'Due', icon: CalendarClock };
const blocked: NavItem = { to: '/blocked', label: 'Blocked', icon: Lock };
const tags: NavItem = { to: '/tags', label: 'Tags', icon: Tag };
const search: NavItem = { to: '/search', label: 'Search', icon: Search };
const projects: NavItem = { to: '/projects', label: 'Projects', icon: Folders };
const goals: NavItem = { to: '/goals', label: 'Goals', icon: LayoutDashboard };
const templates: NavItem = { to: '/templates', label: 'Templates', icon: Copy };
const done: NavItem = { to: '/done', label: 'Done', icon: CheckCircle2 };
export const focus: NavItem = { to: '/focus', label: 'Focus', icon: Target };

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
 *  **Tags** + **Search** live in the toolbar — so none of those appear here. */
export const SIDEBAR_GROUPS: NavGroup[] = [
  { items: [inbox, next] },
  { label: 'Lenses', items: [backlog, due, blocked, done] },
  { label: 'Organize', items: [projects, goals, templates] },
];
