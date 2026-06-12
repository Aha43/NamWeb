// Test fixture for the network-mocked journeys (#61).
//
// Extends the base Playwright test so every journey:
//   • installs the auth + REST Supabase mocks (no backend — see mocks/supabase.ts),
//   • seeds the mocked workspace document (override per spec via `test.use({ seedDoc })`),
//   • points the app at the isolated `e2e` workspace row.
//
// Auth itself comes from the `mocked-setup` project's storageState (a one-time mocked sign-in),
// so journeys start already authenticated. Usage:
//
//   import { test, expect } from '../../mockedTest';
//   test.use({ seedDoc: new DocBuilder().project('p1', 'Roof').build() });
//   test('...', async ({ page, doc }) => { ... });

import { test as base, expect } from '@playwright/test';
import type { WorkspaceDocument } from '../src/domain/types';
import { WORKSPACE_STORAGE_KEY } from './workspace';
import { E2E } from './env';
import { emptyDoc } from './mocks/docBuilder';
import { installAuthMock, installRestMock, type RestMockOptions } from './mocks/supabase';

interface MockedFixtures {
  /** The document the mocked workspace is seeded with. Override per spec via `test.use`. */
  seedDoc: WorkspaceDocument;
  /** Failure modes for the REST mock (load error / forced conflict). Override via `test.use`. */
  restOptions: RestMockOptions;
  /** Handle to the live mocked doc — inspect it after pushes to assert persisted state. */
  doc: { current(): WorkspaceDocument; version(): number };
}

export const test = base.extend<MockedFixtures>({
  seedDoc: [emptyDoc(), { option: true }],
  restOptions: [{}, { option: true }],

  // `auto` so the mocks install for every journey, even one that never references `doc`.
  doc: [
    async ({ page, seedDoc, restOptions }, use) => {
      await installAuthMock(page);
      const handle = await installRestMock(page, seedDoc, restOptions);
      // Select the isolated workspace row before any app code runs.
      await page.addInitScript(
        ([key, value]) => window.localStorage.setItem(key, value),
        [WORKSPACE_STORAGE_KEY, E2E.workspaceName] as const,
      );
      await use(handle);
    },
    { auto: true },
  ],
});

export { expect };
