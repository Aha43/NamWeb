import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({
  ...(await orig<typeof import('react-router-dom')>()),
  useNavigate: () => navigate,
}));

// Radix's dropdown doesn't open under jsdom (portal + pointer events); render the
// items inline so AccountMenu's onClick wiring is what's under test.
vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
    <button role="menuitem" onClick={onClick}>
      {children}
    </button>
  ),
}));

import { AccountMenu } from './AccountMenu';

function setup(onSignOut = vi.fn()) {
  render(
    <MemoryRouter>
      <AccountMenu onSignOut={onSignOut} />
    </MemoryRouter>,
  );
  return onSignOut;
}

describe('AccountMenu', () => {
  it('navigates to the account page', () => {
    setup();
    fireEvent.click(screen.getByRole('menuitem', { name: /^account$/i }));
    expect(navigate).toHaveBeenCalledWith('/account');
  });

  it('navigates to settings (preferences tab)', () => {
    setup();
    fireEvent.click(screen.getByRole('menuitem', { name: /settings/i }));
    expect(navigate).toHaveBeenCalledWith('/account?tab=preferences');
  });

  it('signs out', () => {
    const onSignOut = setup();
    fireEvent.click(screen.getByRole('menuitem', { name: /sign out/i }));
    expect(onSignOut).toHaveBeenCalled();
  });
});
