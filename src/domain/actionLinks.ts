// Action links (#658): a link from one card to another, stored as an ordinary URI resource with
// the nam:// scheme — `{ type: 'URI', value: 'nam://action/<id>' }`. ResourceType mirrors a
// NamDesktop Java enum, so a brand-new type would break desktop deserialization; the scheme rides
// the existing enum instead. Desktop round-trips it (showing a raw URI — harmless) and can adopt
// the scheme later. What's stored is the stable id; what's shown is the target's live path.

import type { Resource } from './types';

export const ACTION_LINK_PREFIX = 'nam://action/';

export function makeActionLink(targetId: string): Resource {
  return { type: 'URI', value: `${ACTION_LINK_PREFIX}${targetId}`, description: null };
}

/** The linked action's id when `resource` is an action link, else null. */
export function parseActionLink(resource: Resource): string | null {
  return resource.type === 'URI' && resource.value.startsWith(ACTION_LINK_PREFIX)
    ? resource.value.slice(ACTION_LINK_PREFIX.length)
    : null;
}
