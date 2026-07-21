import { useContext, useEffect, useRef } from 'react';
import { WorkspaceContext } from '@/store/workspace-context';
import { useSettings } from '@/components/settings/settings-context';
import { fetchOwnerShares } from './shares';
import { drainShare } from './drainShare';

/** The app-open drain trigger (#811): once per mount, after the document first loads. Quiet —
 *  a failed drain simply waits for the next trigger (dialog open, next app open). */
export function ShareEventDrain() {
  const { labs } = useSettings();
  const workspace = useContext(WorkspaceContext);
  const ran = useRef(false);
  const doc = workspace?.document;
  const dispatch = workspace?.dispatch;
  const flush = workspace?.flush;
  // The drain keys off the COMMITTED document (#850) — read live inside drainShare, after the claim.
  const getCommittedDocument = workspace?.getCommittedDocument;
  useEffect(() => {
    if (!labs || ran.current || !doc || !dispatch || !flush || !getCommittedDocument) return;
    ran.current = true;
    void (async () => {
      try {
        for (const share of await fetchOwnerShares()) {
          await drainShare(getCommittedDocument, dispatch, flush, share);
        }
      } catch {
        // Offline / RLS hiccup: nothing claimed, nothing lost — retried on the next trigger.
      }
    })();
  }, [labs, doc, dispatch, flush, getCommittedDocument]);
  return null;
}
