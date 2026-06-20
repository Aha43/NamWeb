import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PromptButton } from './prompt-button';

describe('PromptButton', () => {
  it('opens a pre-filled input and submits the trimmed value', () => {
    const onSubmit = vi.fn();
    render(
      <PromptButton aria-label="Rename tag home" label="New name" initialValue="home" submitLabel="Rename" onSubmit={onSubmit}>
        edit
      </PromptButton>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Rename tag home' }));
    const input = screen.getByLabelText('New name');
    expect(input).toHaveValue('home'); // pre-filled
    fireEvent.change(input, { target: { value: '  house  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' })); // submit (the popover's button)
    expect(onSubmit).toHaveBeenCalledWith('house');
  });

  it('suggests existing values and fills the input when one is picked', () => {
    const onSubmit = vi.fn();
    render(
      <PromptButton aria-label="Add tag" label="Tag" suggestions={['home', 'work', 'house']} onSubmit={onSubmit}>
        tag
      </PromptButton>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add tag' }));
    const input = screen.getByLabelText('Tag');
    fireEvent.change(input, { target: { value: 'ho' } }); // matches home + house
    expect(screen.getByRole('option', { name: 'home' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'house' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'work' })).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('option', { name: 'house' }));
    expect(input).toHaveValue('house');
  });

  it('does not submit an empty value, and cancels cleanly', () => {
    const onSubmit = vi.fn();
    render(
      <PromptButton aria-label="Add" label="Name" onSubmit={onSubmit}>
        add
      </PromptButton>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
