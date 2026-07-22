import { useTranslation } from 'react-i18next';
import type { ProjectTemplate, TemplateNode } from '../../domain/types';

function countNodes(nodes: TemplateNode[]): number {
  return nodes.reduce((n, node) => n + 1 + countNodes(node.children), 0);
}

export interface TemplatesPanelProps {
  templates: ProjectTemplate[];
  onDelete: (name: string) => void;
  /** Create a new top-level project from a template (#864). Omit for a delete-only list. */
  onUse?: (name: string) => void;
}

/** List of saved project templates, each with "Create project" + delete. Presentational. */
export function TemplatesPanel({ templates, onDelete, onUse }: TemplatesPanelProps) {
  const { t } = useTranslation();
  return (
    <section>
      {templates.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 px-6 py-10 text-center">
          <p className="text-sm font-medium text-foreground">{t('templates.emptyTitle')}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{t('templates.emptyHint')}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {templates.map((template) => (
            <li key={template.name} className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">{template.name}</span>
                <span className="text-xs text-muted-foreground">{t('templates.itemCount', { count: countNodes(template.children) })}</span>
              </span>
              {onUse && (
                <button
                  type="button"
                  aria-label={t('templates.useAria', { name: template.name })}
                  onClick={() => onUse(template.name)}
                  className="shrink-0 rounded-md border border-input px-2 py-1 text-xs font-medium text-foreground hover:bg-accent"
                >
                  {t('templates.useAction')}
                </button>
              )}
              <button
                type="button"
                aria-label={t('templates.deleteAria', { name: template.name })}
                onClick={() => onDelete(template.name)}
                className="rounded-md px-1.5 text-muted-foreground hover:text-destructive"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
