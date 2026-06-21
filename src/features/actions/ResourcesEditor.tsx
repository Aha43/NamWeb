import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Resource, ResourceType } from '@/domain/types';

const RESOURCE_TYPES: ResourceType[] = ['URI', 'EMAIL', 'FILE', 'TEXT'];

/** Add/remove attached resources (links/files/notes). Local edits are reported via onChange and
 *  committed by the surrounding editor (the action dialog, or the project workbench Details panel).
 *  FILE is link/metadata only (no upload). */
export function ResourcesEditor({
  resources,
  onChange,
}: {
  resources: Resource[];
  onChange: (resources: Resource[]) => void;
}) {
  const [type, setType] = useState<ResourceType>('URI');
  const [value, setValue] = useState('');

  function add() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onChange([...resources, { type, value: trimmed, description: null }]);
    setValue('');
  }

  return (
    <div className="space-y-1.5">
      {resources.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {resources.map((r, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{r.type}</span>
              <span className="min-w-0 flex-1 truncate text-foreground">{r.value}</span>
              <button
                type="button"
                aria-label={`Remove resource ${r.value}`}
                onClick={() => onChange(resources.filter((_, idx) => idx !== i))}
                className="rounded-md px-1.5 text-muted-foreground hover:text-destructive"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No resources.</p>
      )}
      <div className="flex gap-2">
        <select
          aria-label="Resource type"
          value={type}
          onChange={(e) => setType(e.target.value as ResourceType)}
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm outline-hidden focus:border-ring"
        >
          {RESOURCE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <Input
          aria-label="Resource value"
          placeholder="https://… or a note"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={add}>
          Add
        </Button>
      </div>
    </div>
  );
}
