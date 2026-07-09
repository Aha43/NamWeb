import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DueFieldset, type DueFields } from './DueFieldset';

const EMPTY: DueFields = { dueAt: null, dueEndAt: null, dueTime: null, dueEndTime: null };

function setup(value: DueFields = EMPTY) {
  const onCommit = vi.fn();
  render(<DueFieldset idPrefix="project" value={value} onCommit={onCommit} />);
  return onCommit;
}

describe('DueFieldset', () => {
  it('commits a flexible start date on blur, echoed canonical', () => {
    const onCommit = setup();
    const due = screen.getByLabelText('Due');
    fireEvent.change(due, { target: { value: '26-8-15' } });
    fireEvent.blur(due);
    expect(onCommit).toHaveBeenCalledWith({ dueAt: '2026-08-15', dueEndAt: null, dueTime: null, dueEndTime: null });
    expect(due).toHaveValue('2026-08-15');
  });

  it('blurring untouched inputs commits nothing (#711)', () => {
    const onCommit = setup({ dueAt: '2026-08-10', dueEndAt: null, dueTime: null, dueEndTime: null });
    fireEvent.blur(screen.getByLabelText('Due'));
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('pristine drafts resync when the persisted value changes underneath (#711)', () => {
    const onCommit = vi.fn();
    const { rerender } = render(
      <DueFieldset idPrefix="project" value={{ ...EMPTY, dueAt: '2026-08-10' }} onCommit={onCommit} />,
    );
    // Another device moved the date — the untouched draft follows, and a blur still writes nothing.
    rerender(<DueFieldset idPrefix="project" value={{ ...EMPTY, dueAt: '2026-08-20' }} onCommit={onCommit} />);
    const due = screen.getByLabelText('Due');
    expect(due).toHaveValue('2026-08-20');
    fireEvent.blur(due);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('an active edit survives a remote value change — last writer wins (#711)', () => {
    const onCommit = vi.fn();
    const { rerender } = render(
      <DueFieldset idPrefix="project" value={{ ...EMPTY, dueAt: '2026-08-10' }} onCommit={onCommit} />,
    );
    const due = screen.getByLabelText('Due');
    fireEvent.change(due, { target: { value: '2026-08-12' } }); // user is mid-edit (dirty)
    rerender(<DueFieldset idPrefix="project" value={{ ...EMPTY, dueAt: '2026-08-20' }} onCommit={onCommit} />);
    expect(due).toHaveValue('2026-08-12'); // the draft is not clobbered
    fireEvent.blur(due);
    expect(onCommit).toHaveBeenCalledWith({ dueAt: '2026-08-12', dueEndAt: null, dueTime: null, dueEndTime: null });
  });

  it('keeps the extras collapsed until asked, open when the value carries them (#559)', () => {
    setup();
    expect(screen.queryByLabelText('Due end (optional)')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /add time or a range/i }));
    expect(screen.getByLabelText('Due end (optional)')).toBeInTheDocument();
  });

  it('starts expanded and commits a full range with times', () => {
    const onCommit = setup({ dueAt: '2026-08-10', dueEndAt: '2026-08-12', dueTime: null, dueEndTime: null });
    const time = screen.getByLabelText('Due time (optional)'); // extras already open (value has an end)
    fireEvent.change(time, { target: { value: '9' } });
    fireEvent.blur(time);
    expect(onCommit).toHaveBeenCalledWith({ dueAt: '2026-08-10', dueEndAt: '2026-08-12', dueTime: '09:00', dueEndTime: null });
  });

  it('flags an end date before the start and commits nothing', () => {
    const onCommit = setup({ dueAt: '2026-08-10', dueEndAt: '2026-08-12', dueTime: null, dueEndTime: null });
    const end = screen.getByLabelText('Due end (optional)');
    fireEvent.change(end, { target: { value: '2026-08-01' } });
    fireEvent.blur(end);
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('flags a same-day range whose end time precedes the start time (#508)', () => {
    const onCommit = setup({ dueAt: '2026-08-10', dueEndAt: '2026-08-10', dueTime: '14:00', dueEndTime: null });
    const endTime = screen.getByLabelText('Due end time (optional)');
    fireEvent.change(endTime, { target: { value: '09:00' } });
    fireEvent.blur(endTime);
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('clears everything at once', () => {
    const onCommit = setup({ dueAt: '2026-08-10', dueEndAt: '2026-08-12', dueTime: '09:00', dueEndTime: '17:00' });
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onCommit).toHaveBeenCalledWith(EMPTY);
    expect(screen.getByLabelText('Due')).toHaveValue('');
  });

  it('flags an unparseable start date and keeps the caller uncommitted', () => {
    const onCommit = setup();
    const due = screen.getByLabelText('Due');
    fireEvent.change(due, { target: { value: 'whenever' } });
    fireEvent.blur(due);
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/date like/i);
  });
});
