import {
  CalendarClock,
  CheckCircle2,
  Folders,
  Inbox,
  Layers,
  ListTodo,
  Lock,
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

/** All routable surfaces. The desktop sidebar shows them all; the phone bottom bar
 *  foregrounds a subset (capture + execution) and the rest live in the More sheet. */
export const SURFACES: NavItem[] = [
  { to: '/inbox', label: 'Inbox', icon: Inbox },
  { to: '/next', label: 'Next', icon: ListTodo },
  { to: '/backlog', label: 'Backlog', icon: Layers },
  { to: '/due', label: 'Due', icon: CalendarClock },
  { to: '/blocked', label: 'Blocked', icon: Lock },
  { to: '/tags', label: 'Tags', icon: Tag },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/projects', label: 'Projects', icon: Folders },
  { to: '/done', label: 'Done', icon: CheckCircle2 },
  { to: '/focus', label: 'Focus', icon: Target },
];
