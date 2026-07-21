import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { effectiveDue } from '@/domain/derivedDue';
import { ProjectsPanel } from '@/features/projects/ProjectsPanel';
import { useSharedProjectIds } from './useSharedProjectIds';
import { useWorkspaceContext } from '@/store/workspace-context';
import type { NamNode } from '@/domain/types';

/**
 * The Shared view (#857): the owner's published projects rendered in the ordinary project list, so
 * it's easy to find what's been shared. Read-only — click a project to open its workbench, where the
 * Share button manages the share. Data is the `project_shares` table (fetchOwnerShares, RLS-scoped to
 * the owner), joined back to the live workspace document.
 */
export function SharedProjectsPage() {
  const { t } = useTranslation();
  const { document } = useWorkspaceContext();
  const navigate = useNavigate();
  const shared = useSharedProjectIds(); // null while loading

  // Join shared project ids → live project nodes. A share may point at a project deleted or not in
  // this workspace — filter those out. Sort by title for a stable list.
  const projects: NamNode[] =
    document && shared
      ? [...shared]
          .map((id) => document.nodes[id])
          .filter((n): n is NamNode => Boolean(n) && n.project)
          .sort((a, b) => a.title.localeCompare(b.title))
      : [];

  // While the shares fetch OR the workspace document is still loading, hold the panel back so the
  // "nothing shared yet" empty state doesn't flash for an owner who does have shares.
  if (shared === null || !document) {
    return <section className="py-10 text-center text-sm text-muted-foreground">{t('shared.loading')}</section>;
  }

  return (
    <ProjectsPanel
      projects={projects}
      effectiveDueOf={document ? (id) => effectiveDue(document, id) : undefined}
      onOpen={(id) => navigate(`/projects/${id}`)}
      emptyTitle={t('shared.empty')}
      emptyHint={t('shared.emptyHint')}
    />
  );
}
