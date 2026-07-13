/** Canonical (key-sorted) JSON string (#772/F2): Postgres jsonb does not preserve key order,
 *  so insertion-order stringify never matches a round-tripped value. Dependency-free — the
 *  real-stack smoke imports it directly. */
export function canonicalSnapshot(value: unknown): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === 'object') {
      return Object.fromEntries(
        Object.keys(v as Record<string, unknown>)
          .sort()
          .map((k) => [k, sort((v as Record<string, unknown>)[k])]),
      );
    }
    return v;
  };
  return JSON.stringify(sort(value));
}
