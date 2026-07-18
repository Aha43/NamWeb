import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { UseWorkspace } from '@/store/useWorkspace';
import { WorkspaceContext } from '@/store/workspace-context';
import { QuestionPill } from './QuestionPill';

describe('QuestionPill (#827)', () => {
  it('answering dispatches a SET; tapping the active answer clears it', () => {
    const dispatch = vi.fn();
    const { rerender } = render(
      <WorkspaceContext.Provider value={{ document: null, dispatch } as unknown as UseWorkspace}>
        <QuestionPill nodeId="a1" index={1} answer={null} question="Bringing a tent?" rawValue="?" />
      </WorkspaceContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Answer yes: Bringing a tent?' }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'answerQuestionResource', id: 'a1', index: 1, expectedValue: '?', answer: 'yes' }),
    );

    // Now showing "yes": tapping Yes again clears.
    rerender(
      <WorkspaceContext.Provider value={{ document: null, dispatch } as unknown as UseWorkspace}>
        <QuestionPill nodeId="a1" index={1} answer="yes" question="Bringing a tent?" rawValue="yes" />
      </WorkspaceContext.Provider>,
    );
    const yes = screen.getByRole('button', { name: 'Answer yes: Bringing a tent?' });
    expect(yes).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(yes);
    expect(dispatch).toHaveBeenLastCalledWith(expect.objectContaining({ answer: 'clear', expectedValue: 'yes' }));
  });

  it('the host onAnswer overrides the workspace dispatch (guest page)', () => {
    const onAnswer = vi.fn();
    render(<QuestionPill nodeId="a1" index={0} answer="no" question="Vaccinated?" onAnswer={onAnswer} />);
    fireEvent.click(screen.getByRole('button', { name: 'Answer no: Vaccinated?' }));
    expect(onAnswer).toHaveBeenCalledWith('clear'); // no was active → clear
  });

  it('renders read-only without a workspace or host (presentational)', () => {
    render(<QuestionPill nodeId="a1" index={0} answer="yes" question="Bringing a tent?" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Bringing a tent?')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
  });
});
