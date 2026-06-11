import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_WORKSPACE,
  DEV_WORKSPACE,
  getWorkspaceName,
  isDevWorkspaceSelected,
  setWorkspaceName,
} from './workspace';

afterEach(() => localStorage.clear());

describe('workspace name resolver', () => {
  it('falls back to the default when nothing is stored', () => {
    expect(getWorkspaceName()).toBe(DEFAULT_WORKSPACE);
    expect(isDevWorkspaceSelected()).toBe(false);
  });

  it('persists and reads an explicit choice', () => {
    setWorkspaceName(DEV_WORKSPACE);
    expect(getWorkspaceName()).toBe('dev');
    expect(isDevWorkspaceSelected()).toBe(true);
  });

  it('clears back to the default with null', () => {
    setWorkspaceName(DEV_WORKSPACE);
    setWorkspaceName(null);
    expect(getWorkspaceName()).toBe(DEFAULT_WORKSPACE);
    expect(isDevWorkspaceSelected()).toBe(false);
  });
});
