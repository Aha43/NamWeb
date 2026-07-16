// The resource-type registry (#798): one definition per type, consumed by the dialog and the
// rows — a new resource type is a one-entry job, not a hunt for scattered conditionals.
// Invariant across the family: `value` is for machines, `description` is for humans.

import { FileText, Hash, Link2, Mail, StickyNote, type LucideIcon } from 'lucide-react';
import type { ResourceType } from '@/domain/types';

export interface ResourceTypeDef {
  type: ResourceType;
  icon: LucideIcon;
  /** i18n key for the type's display name (the dialog's select, tooltips). */
  labelKey: string;
  /** The dialog shows the optional human-name field (stored in `description`). */
  hasNameField: boolean;
  /** i18n key for that field's label — "Link name" fits a URI, not a counter (#800). */
  nameLabelKey?: string;
  /** The dialog's value entry: free text, or the COUNT target (a number ≥ 1). */
  valueKind: 'text' | 'countTarget';
  /** The type has registry-defined legal moves a guest could exercise (#809) — gates the
   *  per-resource guestEditable checkbox. */
  interactive?: boolean;
}

export const RESOURCE_TYPE_DEFS: Record<ResourceType, ResourceTypeDef> = {
  URI: { type: 'URI', icon: Link2, labelKey: 'resourceType.URI', hasNameField: true, nameLabelKey: 'editor.resourceName', valueKind: 'text' },
  EMAIL: { type: 'EMAIL', icon: Mail, labelKey: 'resourceType.EMAIL', hasNameField: false, valueKind: 'text' },
  FILE: { type: 'FILE', icon: FileText, labelKey: 'resourceType.FILE', hasNameField: false, valueKind: 'text' },
  TEXT: { type: 'TEXT', icon: StickyNote, labelKey: 'resourceType.TEXT', hasNameField: false, valueKind: 'text' },
  COUNT: { type: 'COUNT', icon: Hash, labelKey: 'resourceType.COUNT', hasNameField: true, nameLabelKey: 'editor.resourceNameCount', valueKind: 'countTarget', interactive: true },
};

export const RESOURCE_TYPES_ORDERED: ResourceType[] = ['URI', 'EMAIL', 'FILE', 'TEXT', 'COUNT'];
