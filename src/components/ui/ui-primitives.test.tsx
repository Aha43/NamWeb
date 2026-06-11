import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input } from './input';
import { Textarea } from './textarea';
import { Label } from './label';
import { Dialog, DialogContent, DialogTitle } from './dialog';

describe('ui primitives', () => {
  it('renders input, textarea and an associated label', () => {
    render(
      <div>
        <Label htmlFor="title">Title</Label>
        <Input id="title" defaultValue="hello" />
        <Textarea aria-label="notes" defaultValue="world" />
      </div>,
    );
    expect(screen.getByLabelText('Title')).toHaveValue('hello');
    expect(screen.getByLabelText('notes')).toHaveValue('world');
  });

  it('renders dialog content with its title when open', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Edit action</DialogTitle>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Edit action')).toBeInTheDocument();
  });
});
