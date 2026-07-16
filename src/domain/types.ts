// TypeScript mirror of the NamDesktop workspace document, as serialized into the
// Supabase `workspaces.document` JSONB column. Field names match the Java/Jackson
// output exactly so this client reads and writes the same blob the desktop does.
// Source of truth: NamDesktop `JsonWorkspaceRepository` / `NamNode` / `NodeStatus`.

export type NodeStatus = 'NEXT' | 'BACKLOG' | 'DONE' | 'CANCELLED' | 'ARCHIVED';

export type ResourceType = 'TEXT' | 'EMAIL' | 'URI' | 'FILE' | 'COUNT';

export interface Resource {
  type: ResourceType;
  value: string;
  description: string | null;
  /** Guests may exercise this resource's legal moves on shared pages (#809 — see
   *  docs/features/project-sharing/guest-interactive-resources.md). Additive,
   *  absent-means-off; only meaningful on interactive types (COUNT). */
  guestEditable?: boolean;
}

export interface NamNode {
  id: string;
  title: string;
  description: string | null;
  status: NodeStatus;
  project: boolean;
  childIds: string[];
  tags: string[];
  blockedBy: string[];
  resources: Resource[];
  /** ISO-8601 local date-times (e.g. "2026-03-15T14:30:00") or null. */
  createdAt: string | null;
  updatedAt: string | null;
  statusChangedAt: string | null;
  /** ISO-8601 local date (e.g. "2026-03-20") or null. The start / sortable date. */
  dueAt: string | null;
  /**
   * Optional end of a date range (ISO local date, inclusive). A range exists iff this and `dueAt`
   * are both set and `dueEndAt >= dueAt`; `dueAt` alone is a single date. Shared NamDesktop contract
   * (it round-trips this field). Sort/grouping always key on the start (`dueAt`). See #438.
   */
  dueEndAt?: string | null;
  /**
   * Optional time of day for the start (`dueAt`) — local wall-clock `"HH:MM"` (24h, no timezone),
   * e.g. a 14:30 appointment. Only meaningful with a `dueAt`; the range end (`dueEndAt`) stays
   * date-only. Shared NamDesktop contract (round-trips via the workspace blob's unknown-field
   * passthrough until desktop adds explicit support). Sort/grouping key on the date; time is a
   * within-day tiebreak. See #493.
   */
  dueTime?: string | null;
  /**
   * Optional time of day for the range end (`dueEndAt`) — local wall-clock `"HH:MM"`. Only meaningful
   * when `dueEndAt` is set. Same additive shared-contract treatment as `dueTime`. See #500.
   */
  dueEndTime?: string | null;
  /**
   * Projects only: derive the time span from the subtree's dated contents (opt-in; absent = off =
   * explicit dates only). Explicit `dueAt`/`dueEndAt` win per edge; derivation fills the gaps.
   * Derived values are never persisted — a pure read-model lens (`effectiveDue`). Same additive
   * shared-contract treatment as `dueTime`. See docs/features/derived-project-time/design.md.
   */
  deriveDue?: boolean;
}

export interface SavedView {
  name: string;
  tags: string[];
  nextOnly: boolean;
}

export interface MissionControl {
  name: string;
  tags: string[];
}

export type BookmarkKind = 'project' | 'tagFilter';

/** A saved quick-jump target shown as a colored icon in the toolbar. Synced in the workspace doc. */
export interface Bookmark {
  id: string;
  /** Shown in the tooltip; defaults from the project name or the tag selection. */
  label: string;
  kind: BookmarkKind;
  /** When kind === 'project'. */
  projectId?: string;
  /** When kind === 'tagFilter'. */
  tags?: string[];
  /** When kind === 'tagFilter': restrict to Next actions. */
  nextOnly?: boolean;
  /** A swatch color (hex) from the bookmark palette. */
  color: string;
}

export interface TemplateNode {
  title: string;
  project: boolean;
  children: TemplateNode[];
}

export interface ProjectTemplate {
  name: string;
  children: TemplateNode[];
}

export interface WorkspaceDocument {
  formatVersion: number;
  rootNodeId: string;
  inboxNodeId: string;
  projectsNodeId: string;
  nextActionsNodeId: string;
  nodes: Record<string, NamNode>;
  registeredTags: string[];
  savedViews: SavedView[];
  missionControls: MissionControl[];
  templates: ProjectTemplate[];
  viewOrders: Record<string, string[]>;
  /** Toolbar quick-jump bookmarks. Optional: older/desktop documents may omit it (treat as []). */
  bookmarks?: Bookmark[];
}
