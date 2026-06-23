/**
 * Read-only display of tags a node inherits from its ancestor projects ("tag rub-off").
 * They filter and behave like real tags but can't be edited here — only on the project that
 * carries them. Shown italic/muted to set them apart from the node's own (editable) tags.
 * Renders nothing when there are no inherited tags.
 */
export function InheritedTags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-1 pt-0.5 text-xs text-muted-foreground"
      title="Inherited from a parent project — edit them on that project"
    >
      <span className="italic">From project:</span>
      {tags.map((tag) => (
        <span key={tag} className="rounded bg-muted px-1.5 py-0.5 italic">
          {tag}
        </span>
      ))}
    </div>
  );
}
