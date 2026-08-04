// A tiny app-wide signal that the set of *published* projects changed (#1023 review). The owner's
// shared-project ids are read by several long-lived consumers (the projects list, the workbench
// Features button, the action editor's `#shared-*` gating) via `useSharedProjectIds`, which snapshots
// once on mount. Publishing/unpublishing in `ShareDialog` must nudge those consumers to refetch —
// otherwise a freshly-shared project keeps its share features hidden (and a revoked one keeps them
// showing) until a full reload. Deliberately dumb: one event, no payload; listeners just refetch.

const target = new EventTarget();
const EVENT = 'shares-changed';

/** Announce that a project was published or unpublished (the shared-project set may have changed). */
export function emitSharesChanged(): void {
  target.dispatchEvent(new Event(EVENT));
}

/** Subscribe to share-set changes; returns an unsubscribe. */
export function onSharesChanged(listener: () => void): () => void {
  target.addEventListener(EVENT, listener);
  return () => target.removeEventListener(EVENT, listener);
}
