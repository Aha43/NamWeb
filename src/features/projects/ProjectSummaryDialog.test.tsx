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

  it('Edit makes the text a draft — filters lock, Copy copies the edits, Regenerate undoes (#729)', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const buildSummary = vi.fn(
      (o: { statuses?: string[]; includeSubProjects?: boolean }) =>
        `# P (${(o.statuses ?? []).join(',')})${o.includeSubProjects ? ' +subs' : ''}`,
    );

    render(<ProjectSummaryDialog open onOpenChange={vi.fn()} title="P" buildSummary={buildSummary} />);

    const area = screen.getByLabelText('Project summary (Markdown)');
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(area).not.toHaveAttribute('readonly');
    // The filters describe the generated text — locked while a draft exists.
    expect(screen.getByLabelText('Done')).toBeDisabled();
    expect(screen.getByLabelText('Include sub-projects')).toBeDisabled();

    fireEvent.change(area, { target: { value: '# P (NEXT,BACKLOG) +subs\n\nOne extra remark.' } });
    fireEvent.click(screen.getByRole('button', { name: /Copy/ }));
    expect(writeText).toHaveBeenCalledWith('# P (NEXT,BACKLOG) +subs\n\nOne extra remark.');

    // Regenerate discards the draft: generated text is back, filters live again.
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate' }));
    expect(area).toHaveValue('# P (NEXT,BACKLOG) +subs');
    expect(area).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Done')).toBeEnabled();
  });

  it('a reopened dialog starts from the generated view, not a stale draft (#729)', () => {
    const buildSummary = () => '# generated';
    const { rerender } = render(
      <ProjectSummaryDialog open onOpenChange={vi.fn()} title="P" buildSummary={buildSummary} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Project summary (Markdown)'), { target: { value: 'scribbles' } });

    // The dialog stays mounted across opens (the workbench renders it controlled).
    rerender(<ProjectSummaryDialog open={false} onOpenChange={vi.fn()} title="P" buildSummary={buildSummary} />);
    rerender(<ProjectSummaryDialog open onOpenChange={vi.fn()} title="P" buildSummary={buildSummary} />);
    expect(screen.getByLabelText('Project summary (Markdown)')).toHaveValue('# generated');
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('closing with un-copied edits asks first; Regenerate-free discard needs the confirm (#735)', () => {
    const onOpenChange = vi.fn();
    render(
      <ProjectSummaryDialog open onOpenChange={onOpenChange} title="P" buildSummary={() => '# generated'} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Project summary (Markdown)'), { target: { value: 'my words' } });

    // Close with a dirty draft → the confirm appears instead of closing.
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]); // corner ✕ and footer Close share the guard
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByText('Discard your edits?')).toBeInTheDocument();

    // Cancel keeps editing (nothing lost)…
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText('Project summary (Markdown)')).toHaveValue('my words');

    // …Discard closes for real.
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]); // corner ✕ and footer Close share the guard
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('an untouched draft closes freely — no confirm (#735)', () => {
    const onOpenChange = vi.fn();
    render(
      <ProjectSummaryDialog open onOpenChange={onOpenChange} title="P" buildSummary={() => '# generated'} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]); // corner ✕ and footer Close share the guard
    expect(screen.queryByText('Discard your edits?')).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('⌘/Ctrl+Enter with a dirty draft copies it and closes without asking (#735)', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const onOpenChange = vi.fn();
    render(
      <ProjectSummaryDialog open onOpenChange={onOpenChange} title="P" buildSummary={() => '# generated'} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const area = screen.getByLabelText('Project summary (Markdown)');
    fireEvent.change(area, { target: { value: 'my words' } });
    fireEvent.keyDown(area, { key: 'Enter', ctrlKey: true });
    expect(writeText).toHaveBeenCalledWith('my words'); // the copy is what makes it safe
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText('Discard your edits?')).not.toBeInTheDocument();
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
