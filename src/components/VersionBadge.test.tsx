import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VersionBadge } from './VersionBadge';
import { APP_VERSION } from '@/lib/env';

describe('VersionBadge', () => {
  it('shows the app version from package.json', () => {
    render(<VersionBadge />);
    expect(screen.getByText(`v${APP_VERSION}`)).toBeInTheDocument();
  });

  it('falls back to "dev" with no build SHA (no commit link)', () => {
    // Vitest runs with no CF_PAGES_COMMIT_SHA, so BUILD_SHA is empty.
    render(<VersionBadge />);
    expect(screen.getByText('dev')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
