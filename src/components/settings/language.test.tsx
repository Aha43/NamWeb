import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SettingsProvider } from './SettingsProvider';
import { useSettings } from './settings-context';
import i18n, { activateLocale } from '@/lib/i18n';

afterEach(async () => {
  await activateLocale('en');
  try {
    localStorage.clear();
  } catch {
    // ignore
  }
});

function Probe() {
  const { language, setLanguage } = useSettings();
  return (
    <div>
      <span data-testid="lang">{language}</span>
      <button type="button" onClick={() => setLanguage('nb')}>
        to nb
      </button>
    </div>
  );
}

describe('language setting (#518)', () => {
  it('switches the active locale, updates <html lang>, and persists', async () => {
    render(
      <SettingsProvider>
        <Probe />
      </SettingsProvider>,
    );
    expect(screen.getByTestId('lang')).toHaveTextContent('en');

    fireEvent.click(screen.getByText('to nb'));

    expect(screen.getByTestId('lang')).toHaveTextContent('nb');
    await waitFor(() => expect(i18n.language).toBe('nb'));
    expect(document.documentElement.lang).toBe('nb');
    expect(localStorage.getItem('namweb.settings.language')).toBe('nb');
  });
});
