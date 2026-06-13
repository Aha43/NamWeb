import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SettingsProvider } from './SettingsProvider';
import { SettingsDialog } from './SettingsDialog';
import { DATE_FORMAT_STORAGE_KEY } from './settings-context';

afterEach(() => localStorage.clear());

describe('SettingsDialog', () => {
  it('shows the date-format options with samples, defaulting to medium', () => {
    render(
      <SettingsProvider>
        <SettingsDialog open onOpenChange={() => {}} />
      </SettingsProvider>,
    );
    const select = screen.getByLabelText('Date format') as HTMLSelectElement;
    expect(select.value).toBe('medium');
    expect(screen.getByRole('option', { name: /Medium — Jun 14, 2026/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /ISO — 2026-06-14/ })).toBeInTheDocument();
  });

  it('changing the format updates the selection and persists it', () => {
    render(
      <SettingsProvider>
        <SettingsDialog open onOpenChange={() => {}} />
      </SettingsProvider>,
    );
    const select = screen.getByLabelText('Date format') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'iso' } });
    expect(select.value).toBe('iso');
    expect(localStorage.getItem(DATE_FORMAT_STORAGE_KEY)).toBe('iso');
  });
});
