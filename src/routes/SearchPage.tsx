import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchResults } from '@/domain/lenses';
import { SearchPanel, type SearchResultRow } from '@/features/search/SearchPanel';
import { useActionEditor } from '@/features/actions/action-editor-context';
import { useWorkspaceContext } from '@/store/workspace-context';

export function SearchPage() {
  const { document } = useWorkspaceContext();
  const { openEditor } = useActionEditor();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const results: SearchResultRow[] = document
    ? searchResults(document, query).map((r) => ({
        id: r.node.id,
        title: r.node.title,
        type: r.node.project ? 'Project' : 'Action',
        path: r.path,
      }))
    : [];

  return (
    <SearchPanel
      query={query}
      results={results}
      onQueryChange={setQuery}
      onOpen={(row) => (row.type === 'Project' ? navigate(`/projects/${row.id}`) : openEditor(row.id))}
    />
  );
}
