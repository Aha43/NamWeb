import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProjectSummaryDialog } from './ProjectSummaryDialog';

describe('ProjectSummaryDialog', () => {
  it('builds with Next+Backlog by default, regenerates when toggling Done, and copies', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const buildSummary = vi.fn((statuses: string[]) => `# P (${statuses.join(',')})`);

    render(<ProjectSummaryDialog open onOpenChange={vi.fn()} title="P" buildSummary={buildSummary} />);

    const area = screen.getByLabelText('Project summary (Markdown)');
    // Default: Next + Backlog, Done off.
    expect(area).toHaveValue('# P (NEXT,BACKLOG)');

    // Toggling Done regenerates with DONE included.
    fireEvent.click(screen.getByLabelText('Done'));
    expect(area).toHaveValue('# P (NEXT,BACKLOG,DONE)');

    // Copy writes the current markdown.
    fireEvent.click(screen.getByRole('button', { name: /Copy/ }));
    expect(writeText).toHaveBeenCalledWith('# P (NEXT,BACKLOG,DONE)');
    await waitFor(() => expect(screen.getByRole('button', { name: /Copied/ })).toBeInTheDocument());
  });
});
