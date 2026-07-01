import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CaptureContext } from '@/capture/capture-context';
import { SettingsContext, type SettingsContextValue } from '@/components/settings/settings-context';
import { DEFAULT_DATE_FORMAT } from '@/lib/dates';
import { TOOLBAR_SEARCH_ID, useGlobalShortcuts } from './useGlobalShortcuts';

function Harness({ withSearchBox = false }: { withSearchBox?: boolean }) {
  useGlobalShortcuts();
  const location = useLocation();
  return (
    <div>
      <span data-testid="path">{location.pathname}</span>
      {withSearchBox && <input id={TOOLBAR_SEARCH_ID} aria-label="Search workspace" />}
      <input aria-label="some field" />
    </div>
  );
}

function setup(openCapture = vi.fn(), opts?: { withSearchBox?: boolean }) {
  render(
    <CaptureContext.Provider value={{ openCapture }}>
      <MemoryRouter initialEntries={['/inbox']}>
        <Routes>
          <Route path="*" element={<Harness withSearchBox={opts?.withSearchBox} />} />
        </Routes>
      </MemoryRouter>
    </CaptureContext.Provider>,
  );
  return { openCapture };
}

const path = () => screen.getByTestId('path').textContent;

afterEach(() => vi.restoreAllMocks());

describe('useGlobalShortcuts', () => {
  it('opens capture on "c"', () => {
    const { openCapture } = setup();
    fireEvent.keyDown(window, { key: 'c' });
    expect(openCapture).toHaveBeenCalledOnce();
  });

  it('flips the add-to-top/bottom toggle on "t"', () => {
    const setAddToBottom = vi.fn();
    const settings: SettingsContextValue = {
      dateFormat: DEFAULT_DATE_FORMAT,
      setDateFormat: vi.fn(),
      language: 'en',
      setLanguage: vi.fn(),
      addToBottom: false,
      setAddToBottom,
      addToBottomDefault: false,
      setAddToBottomDefault: vi.fn(),
    };
    render(
      <SettingsContext.Provider value={settings}>
        <CaptureContext.Provider value={{ openCapture: vi.fn() }}>
          <MemoryRouter initialEntries={['/inbox']}>
            <Routes>
              <Route path="*" element={<Harness />} />
            </Routes>
          </MemoryRouter>
        </CaptureContext.Provider>
      </SettingsContext.Provider>,
    );
    fireEvent.keyDown(window, { key: 't' });
    expect(setAddToBottom).toHaveBeenCalledWith(true); // false → flipped to bottom
  });

  it('navigates with the g-then-letter chord', () => {
    setup();
    fireEvent.keyDown(window, { key: 'g' });
    fireEvent.keyDown(window, { key: 'n' });
    expect(path()).toBe('/next');

    fireEvent.keyDown(window, { key: 'g' });
    fireEvent.keyDown(window, { key: 'b' });
    expect(path()).toBe('/backlog');
  });

  it('opens Help on "?"', () => {
    setup();
    fireEvent.keyDown(window, { key: '?' });
    expect(path()).toBe('/help');
  });

  it('focuses the toolbar search on "/" when present (no navigation)', () => {
    setup(vi.fn(), { withSearchBox: true });
    fireEvent.keyDown(window, { key: '/' });
    expect(document.activeElement).toBe(document.getElementById(TOOLBAR_SEARCH_ID));
    expect(path()).toBe('/inbox'); // didn't navigate away
  });

  it('falls back to navigating to Search on "/" when the box is absent', () => {
    setup();
    fireEvent.keyDown(window, { key: '/' });
    expect(path()).toBe('/search');
  });

  it('does nothing while typing in an input', () => {
    const { openCapture } = setup();
    const field = screen.getByLabelText('some field');
    field.focus();
    fireEvent.keyDown(field, { key: 'c' });
    fireEvent.keyDown(field, { key: 'g' });
    fireEvent.keyDown(field, { key: 'n' });
    expect(openCapture).not.toHaveBeenCalled();
    expect(path()).toBe('/inbox');
  });

  it('ignores Ctrl/Cmd combos so browser shortcuts pass through', () => {
    const { openCapture } = setup();
    fireEvent.keyDown(window, { key: 'c', metaKey: true });
    fireEvent.keyDown(window, { key: 'c', ctrlKey: true });
    expect(openCapture).not.toHaveBeenCalled();
  });

  it('forgets a lone "g" that is not followed by a mapped key', () => {
    setup();
    fireEvent.keyDown(window, { key: 'g' });
    fireEvent.keyDown(window, { key: 'z' }); // not a destination → reset, no nav
    expect(path()).toBe('/inbox');
  });

  it('suspends shortcuts while a modal dialog is open (#486)', () => {
    const { openCapture } = setup();
    // Simulate an open Radix dialog/overlay in the DOM (portal-rendered in the real app).
    const modal = document.createElement('div');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('data-state', 'open');
    document.body.appendChild(modal);

    fireEvent.keyDown(window, { key: 'c' }); // capture — must not open behind the modal
    fireEvent.keyDown(window, { key: 'g' });
    fireEvent.keyDown(window, { key: 'n' }); // nav chord — must not navigate
    expect(openCapture).not.toHaveBeenCalled();
    expect(path()).toBe('/inbox');

    // With the modal gone, shortcuts work again.
    modal.remove();
    fireEvent.keyDown(window, { key: 'c' });
    expect(openCapture).toHaveBeenCalledOnce();
  });
});
