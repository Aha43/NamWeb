import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProjectSummaryDialog } from './ProjectSummaryDialog';

describe('ProjectSummaryDialog', () => {
  it('shows the markdown and copies it to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    render(
      <ProjectSummaryDialog open onOpenChange={vi.fn()} title="Kitchen reno" markdown={'# Kitchen reno\n\n## Buy tiles\n'} />,
    );

    expect(screen.getByLabelText('Project summary (Markdown)')).toHaveValue('# Kitchen reno\n\n## Buy tiles\n');

    fireEvent.click(screen.getByRole('button', { name: /Copy/ }));
    expect(writeText).toHaveBeenCalledWith('# Kitchen reno\n\n## Buy tiles\n');
    await waitFor(() => expect(screen.getByRole('button', { name: /Copied/ })).toBeInTheDocument());
  });
});
