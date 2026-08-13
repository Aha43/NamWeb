import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isChunkLoadError } from '@/lib/chunkError';
import { ChunkErrorBoundary } from './ChunkErrorBoundary';

/** A child that throws on first render — the shape React.lazy takes when a chunk 404s. */
function Boom({ message }: { message: string }): never {
  throw new Error(message);
}

function fakeStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    map,
  };
}

const CHUNK_MSG = 'Failed to fetch dynamically imported module: https://x/assets/FocusPage-abc.js';

describe('isChunkLoadError', () => {
  it('matches the browser-specific dynamic-import failures', () => {
    expect(isChunkLoadError(new Error(CHUNK_MSG))).toBe(true);
    expect(isChunkLoadError(new Error('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('ChunkLoadError: loading chunk 3 failed'))).toBe(true);
  });

  it('does not match ordinary render errors', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});

describe('ChunkErrorBoundary', () => {
  // React logs caught render errors to console.error — silence it so the suite output stays clean.
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('renders children when nothing throws', () => {
    render(
      <ChunkErrorBoundary reload={vi.fn()} storage={fakeStorage()}>
        <p>all good</p>
      </ChunkErrorBoundary>,
    );
    expect(screen.getByText('all good')).toBeInTheDocument();
  });

  it('auto-reloads once on a chunk-load error and records the guard timestamp', () => {
    const reload = vi.fn();
    const store = fakeStorage();
    render(
      <ChunkErrorBoundary reload={reload} now={() => 1000} storage={store}>
        <Boom message={CHUNK_MSG} />
      </ChunkErrorBoundary>,
    );
    expect(reload).toHaveBeenCalledOnce();
    expect(store.map.get('nam:chunk-reload-at')).toBe('1000');
    // The recoverable fallback is shown (briefly, until the reload navigates away).
    expect(screen.getByText("Couldn't load this screen")).toBeInTheDocument();
  });

  it('does not reload-loop when a recent reload is already recorded', () => {
    const reload = vi.fn();
    const store = fakeStorage({ 'nam:chunk-reload-at': '1000' });
    render(
      <ChunkErrorBoundary reload={reload} now={() => 5000} storage={store}>
        <Boom message={CHUNK_MSG} />
      </ChunkErrorBoundary>,
    );
    expect(reload).not.toHaveBeenCalled();
    // A manual Reload escape hatch is offered instead.
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalledOnce();
  });

  it('reloads again once the guard window has elapsed', () => {
    const reload = vi.fn();
    const store = fakeStorage({ 'nam:chunk-reload-at': '1000' });
    render(
      <ChunkErrorBoundary reload={reload} now={() => 20_000} storage={store}>
        <Boom message={CHUNK_MSG} />
      </ChunkErrorBoundary>,
    );
    expect(reload).toHaveBeenCalledOnce();
    expect(store.map.get('nam:chunk-reload-at')).toBe('20000');
  });

  it('survives storage whose methods throw (private mode) — no crash, no reload, manual fallback (Codex P3)', () => {
    const reload = vi.fn();
    // Storage that exists but throws on access — the private-mode shape safeSessionStorage() can't
    // detect up front. The throw must not break the boundary mid-chunk-error.
    const hostile = {
      getItem: () => {
        throw new Error('SecurityError: storage disabled');
      },
      setItem: () => {
        throw new Error('SecurityError: storage disabled');
      },
    };
    render(
      <ChunkErrorBoundary reload={reload} storage={hostile}>
        <Boom message={CHUNK_MSG} />
      </ChunkErrorBoundary>,
    );
    expect(reload).not.toHaveBeenCalled(); // no unguarded auto-reload
    // The recoverable screen still renders, and its manual Reload works.
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalledOnce();
  });

  it('does not auto-reload on a non-chunk render error, but offers manual Reload', () => {
    const reload = vi.fn();
    render(
      <ChunkErrorBoundary reload={reload} storage={fakeStorage()}>
        <Boom message="Cannot read properties of undefined (reading 'x')" />
      </ChunkErrorBoundary>,
    );
    expect(reload).not.toHaveBeenCalled();
    expect(screen.getByText("Couldn't load this screen")).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalledOnce();
  });
});
