/**
 * The Tags view's filter (selected tags + "Next only") lives in the URL so it survives navigation —
 * notably the round-trip into tag-scoped Focus and back. Shared by `TagsPage` (read + write) and
 * `FocusPage` (the focus link's source and the exit destination) so both ends agree on the encoding.
 */
export function tagFilterParams(selected: string[], nextOnly: boolean): URLSearchParams {
  const params = new URLSearchParams();
  if (selected.length > 0) params.set('tags', selected.join(','));
  if (nextOnly) params.set('next', '1');
  return params;
}

export function parseTagFilter(params: URLSearchParams): { selected: string[]; nextOnly: boolean } {
  const raw = params.get('tags');
  return {
    selected: raw ? raw.split(',').filter(Boolean) : [],
    nextOnly: params.get('next') === '1',
  };
}
