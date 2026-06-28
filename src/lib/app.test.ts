import { describe, expect, it } from 'vitest';
import { APP_NAME, brandTooltip } from './app';

describe('brandTooltip', () => {
  it('reads "<name> · v<version> · <build>"', () => {
    // No CF_PAGES_COMMIT_SHA under test, so the build is "dev".
    expect(brandTooltip()).toMatch(new RegExp(`^${APP_NAME} · v\\d+\\.\\d+\\.\\d+ · dev$`));
  });
});
