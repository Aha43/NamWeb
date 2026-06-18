import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ProjectPathLinks } from './ProjectPathLinks';

describe('ProjectPathLinks', () => {
  it('renders each ancestor as a link to its project', () => {
    render(
      <MemoryRouter>
        <ProjectPathLinks path={[{ id: 'h', title: 'Home' }, { id: 'k', title: 'Kitchen' }]} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/projects/h');
    expect(screen.getByRole('link', { name: 'Kitchen' })).toHaveAttribute('href', '/projects/k');
  });

  it('renders nothing for a top-level action (empty path)', () => {
    const { container } = render(
      <MemoryRouter>
        <ProjectPathLinks path={[]} />
      </MemoryRouter>,
    );
    expect(container.querySelector('a')).toBeNull();
  });
});
