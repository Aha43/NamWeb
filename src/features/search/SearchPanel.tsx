import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export interface SearchResultRow {
  id: string;
  title: string;
  type: 'Action' | 'Project';
  path: string[];
}

export interface SearchPanelProps {
  query: string;
  results: SearchResultRow[];
  onQueryChange: (query: string) => void;
  onOpen: (row: SearchResultRow) => void;
}

/** Workspace search across titles and tags. Presentational. */
export function SearchPanel({ query, results, onQueryChange, onOpen }: SearchPanelProps) {
  const { t } = useTranslation();
  return (
    <section className="space-y-4">
      <input
        aria-label={t('domain.search')}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder={t('search.placeholder')}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-base outline-hidden focus:border-ring"
      />

      {query.trim() === '' ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t('search.typeToSearch')}</p>
      ) : results.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t('search.noResults', { query })}</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {results.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                aria-label={t('column.openAria', { title: row.title })}
                onClick={() => onOpen(row)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent"
              >
                <span className="min-w-0 flex-1">
                  {row.path.length > 0 && (
                    <span className="block truncate text-xs text-muted-foreground">{row.path.join(' › ')}</span>
                  )}
                  <span className="block truncate text-sm text-foreground">{row.title}</span>
                </span>
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  {row.type === 'Action' ? t('search.typeAction') : t('search.typeProject')}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
