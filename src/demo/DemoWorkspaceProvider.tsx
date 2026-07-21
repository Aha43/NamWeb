import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { WorkspaceContext } from '@/store/workspace-context';
import type { UseWorkspace } from '@/store/useWorkspace';
import { buildDemo } from '@/domain/buildDemo';
import { applyIntent, type Intent } from '@/domain/mutations';
import type { WorkspaceDocument } from '@/domain/types';
import { newId } from '@/lib/local';
import { DemoContext } from './demo-context';

const KEY = 'namweb.demo.document';

function seed(): WorkspaceDocument {
  return buildDemo(newId, new Date());
}

/** Load the saved demo doc, or a fresh seed if absent/corrupt. */
function load(): WorkspaceDocument {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const doc = JSON.parse(raw) as Partial<WorkspaceDocument>;
      if (doc && doc.formatVersion && doc.nodes && doc.rootNodeId) return doc as WorkspaceDocument;
    }
  } catch {
    // ignore malformed storage — fall through to a fresh seed
  }
  return seed();
}

/**
 * Supplies the same `WorkspaceContext` the real app uses, but backed by a local, localStorage-persisted
 * document — `dispatch` applies intents client-side via `applyIntent`, no Supabase. Also provides the
 * `DemoContext` (reset / sign-up). This is the seam that lets the whole app run with no account.
 */
export function DemoWorkspaceProvider({ onSignUp, children }: { onSignUp: () => void; children: ReactNode }) {
  const [document, setDocument] = useState<WorkspaceDocument>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(document));
    } catch {
      // storage full / unavailable — the demo still works in-memory this session
    }
  }, [document]);

  const dispatch = useCallback((intent: Intent) => setDocument((d) => applyIntent(d, intent)), []);
  const reset = useCallback(() => setDocument(seed()), []);

  const value: UseWorkspace = {
    document,
    loading: false,
    error: null,
    noRemote: false,
    creating: false,
    createWorkspace: () => {},
    notice: null,
    clearNotice: () => {},
    retry: () => {},
    retrySync: () => {},
    // The demo is local-only: every dispatch is as durable as it will ever be, so the committed
    // document is just the current document (the drain's #850 ledger check reads it directly).
    flush: async () => true,
    getCommittedDocument: () => document,
    dispatch,
  };

  return (
    <WorkspaceContext.Provider value={value}>
      <DemoContext.Provider value={{ reset, signUp: onSignUp }}>{children}</DemoContext.Provider>
    </WorkspaceContext.Provider>
  );
}
