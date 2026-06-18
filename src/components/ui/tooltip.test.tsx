import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Tooltip } from './tooltip';

describe('Tooltip', () => {
  it('renders its trigger child (self-contained, no external provider needed)', () => {
    render(
      <Tooltip label="Rename Buy tiles">
        <button type="button">edit</button>
      </Tooltip>,
    );
    expect(screen.getByRole('button', { name: 'edit' })).toBeInTheDocument();
  });

  it('renders the child unwrapped when the label is empty', () => {
    render(
      <Tooltip label="">
        <button type="button">plain</button>
      </Tooltip>,
    );
    expect(screen.getByRole('button', { name: 'plain' })).toBeInTheDocument();
  });
});
