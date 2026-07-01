import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectSummaryDialog } from './ProjectSummaryDialog';
import { activateLocale } from '@/lib/i18n';

// react-i18next uses the global instance (initialized in the test setup, English active), so no
// per-test provider is needed. Restore English after any locale-switch test.
afterEach(async () => {
  await activateLocale('en');
});

describe('ProjectSummaryDialog', () => {
  it('builds with Next+Backlog by default, regenerates when toggling Done, and copies', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const buildSummary = vi.fn(
      (o: { statuses?: string[]; includeSubProjects?: boolean }) =>
        `# P (${(o.statuses ?? []).join(',')})${o.includeSubProjects ? ' +subs' : ''}`,
    );

    render(<ProjectSummaryDialog open onOpenChange={vi.fn()} title="P" buildSummary={buildSummary} />);

    const area = screen.getByLabelText('Project summary (Markdown)');
    // Default: Next + Backlog, Done off, sub-projects on.
    expect(area).toHaveValue('# P (NEXT,BACKLOG) +subs');

    // Toggling Done regenerates with DONE included.
    fireEvent.click(screen.getByLabelText('Done'));
    expect(area).toHaveValue('# P (NEXT,BACKLOG,DONE) +subs');

    // Toggling off sub-projects drops them.
    fireEvent.click(screen.getByLabelText('Include sub-projects'));
    expect(area).toHaveValue('# P (NEXT,BACKLOG,DONE)');

    // Copy writes the current markdown.
    fireEvent.click(screen.getByRole('button', { name: /Copy/ }));
    expect(writeText).toHaveBeenCalledWith('# P (NEXT,BACKLOG,DONE)');
    await waitFor(() => expect(screen.getByRole('button', { name: /Copied/ })).toBeInTheDocument());
  });

  it('⌘/Ctrl+Enter copies and closes (#477)', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const onOpenChange = vi.fn();
    const buildSummary = () => '# P (NEXT,BACKLOG) +subs';

    render(<ProjectSummaryDialog open onOpenChange={onOpenChange} title="P" buildSummary={buildSummary} />);

    fireEvent.keyDown(screen.getByLabelText('Project summary (Markdown)'), { key: 'Enter', ctrlKey: true });
    expect(writeText).toHaveBeenCalledWith('# P (NEXT,BACKLOG) +subs');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('renders Norwegian (nb) when the locale is switched — the i18n spike proof (#400)', async () => {
    await activateLocale('nb');
    render(<ProjectSummaryDialog open onOpenChange={vi.fn()} title="P" buildSummary={() => ''} />);
    // Domain status names + UI strings + the interpolated title all render in Norwegian.
    expect(screen.getByLabelText('Neste')).toBeInTheDocument(); // domain.status.next
    expect(screen.getByLabelText('Etterslep')).toBeInTheDocument(); // domain.status.backlog
    expect(screen.getByRole('button', { name: 'Lukk' })).toBeInTheDocument(); // summary.close
    expect(screen.getByText('Sammendrag — P')).toBeInTheDocument(); // interpolated title
  });
});
