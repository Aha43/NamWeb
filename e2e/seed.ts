// A minimal-but-valid empty workspace document for the E2E `e2e` row.
//
// NamWeb itself never seeds a fresh workspace — it expects the desktop app to have created
// one, and shows a "sync from the desktop app first" wall otherwise. So the E2E reset writes
// this empty document directly (mirroring the structural containers the desktop seeds:
// root → inbox / projects / next-actions), giving the smoke a clean, non-blocking start.

function container(id: string, childIds: string[] = []) {
  return {
    id,
    title: id,
    description: null,
    status: 'BACKLOG',
    project: false,
    childIds,
    tags: [],
    blockedBy: [],
    resources: [],
    createdAt: null,
    updatedAt: null,
    statusChangedAt: null,
    dueAt: null,
  };
}

export function emptyDocument() {
  return {
    formatVersion: 1,
    rootNodeId: 'root',
    inboxNodeId: 'inbox',
    projectsNodeId: 'projects',
    nextActionsNodeId: 'actions',
    nodes: {
      root: container('root', ['inbox', 'projects', 'actions']),
      inbox: container('inbox'),
      projects: container('projects'),
      actions: container('actions'),
    },
    registeredTags: [],
    savedViews: [],
    missionControls: [],
    templates: [],
    viewOrders: {},
  };
}
