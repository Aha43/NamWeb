// TypeScript mirror of the NamDesktop workspace document, as serialized into the
// Supabase `workspaces.document` JSONB column. Field names match the Java/Jackson
// output exactly so this client reads and writes the same blob the desktop does.
// Source of truth: NamDesktop `JsonWorkspaceRepository` / `NamNode` / `NodeStatus`.

export type NodeStatus = 'NEXT' | 'BACKLOG' | 'DONE' | 'CANCELLED' | 'ARCHIVED';

export type ResourceType = 'TEXT' | 'EMAIL' | 'URI' | 'FILE';

export interface Resource {
  type: ResourceType;
  value: string;
  description: string | null;
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
  /** ISO-8601 local date (e.g. "2026-03-20") or null. */
  dueAt: string | null;
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
}
