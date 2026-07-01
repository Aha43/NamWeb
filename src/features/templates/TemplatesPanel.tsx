import { useTranslation } from 'react-i18next';
import type { ProjectTemplate, TemplateNode } from '../../domain/types';

function countNodes(nodes: TemplateNode[]): number {
  return nodes.reduce((n, node) => n + 1 + countNodes(node.children), 0);
}

export interface TemplatesPanelProps {
  templates: ProjectTemplate[];
  onDelete: (name: string) => void;
}

/** List of saved project templates with delete. Presentational. */
export function TemplatesPanel({ templates, onDelete }: TemplatesPanelProps) {
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
