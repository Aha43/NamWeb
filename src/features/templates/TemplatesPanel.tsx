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
  return (
    <section className="mx-auto max-w-2xl">
      {templates.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No templates yet.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {templates.map((template) => (
            <li key={template.name} className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-foreground">{template.name}</span>
                <span className="text-xs text-muted-foreground">{countNodes(template.children)} items</span>
              </span>
              <button
                type="button"
                aria-label={`Delete template ${template.name}`}
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
