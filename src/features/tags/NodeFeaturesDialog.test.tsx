import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IN_PROGRESS_TAG } from '@/domain/systemTags';
import { NodeFeaturesDialog } from './NodeFeaturesDialog';

describe('NodeFeaturesDialog (#1023)', () => {
  it('shows only the applicable rows and reflects the current tags', () => {
    render(
      <NodeFeaturesDialog
        open
        onOpenChange={vi.fn()}
        isProject={false}
        inShare={false}
        tags={[IN_PROGRESS_TAG]}
        onToggle={vi.fn()}
      />,
    );
    // Action, not in a share → only "In progress", and it's checked.
    expect(screen.getByRole('checkbox', { name: /in progress/i })).toBeChecked();
    // The #shared-* grammar stays hidden off a share.
    expect(screen.queryByRole('checkbox', { name: /hidden from share/i })).not.toBeInTheDocument();
  });

  it('reports the tag + new on/off state when a checkbox is toggled', () => {
    const onToggle = vi.fn();
    render(
      <NodeFeaturesDialog
        open
        onOpenChange={vi.fn()}
        isProject={false}
        inShare
        tags={[IN_PROGRESS_TAG]}
        onToggle={onToggle}
      />,
    );
    // In a share, the both-scoped #shared-* rows appear.
    expect(screen.getByRole('checkbox', { name: /hidden from share/i })).toBeInTheDocument();
    // Unchecking the on feature reports (tag, false).
    fireEvent.click(screen.getByRole('checkbox', { name: /in progress/i }));
    expect(onToggle).toHaveBeenCalledWith(IN_PROGRESS_TAG, false);
  });
});
