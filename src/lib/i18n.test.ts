import { afterEach, describe, expect, it } from 'vitest';
import i18n, { activateLocale } from './i18n';

afterEach(async () => {
  await activateLocale('en');
});

describe('i18n runtime (#400)', () => {
  it('interpolates and pluralizes via ICU (en)', () => {
    expect(i18n.t('summary.title', { title: 'Roof' })).toBe('Summary — Roof');
    expect(i18n.t('actions.selectedCount', { count: 1 })).toBe('1 selected');
    expect(i18n.t('actions.selectedCount', { count: 5 })).toBe('5 selected');
  });

  it('switches to Norwegian, including domain vocabulary and ICU', async () => {
    await activateLocale('nb');
    expect(i18n.t('domain.status.next')).toBe('Neste');
    expect(i18n.t('summary.title', { title: 'Tak' })).toBe('Sammendrag — Tak');
    expect(i18n.t('actions.selectedCount', { count: 3 })).toBe('3 valgt');
    expect(document.documentElement.lang).toBe('nb');
  });

  it('dotted keys are literal ids, not paths', () => {
    // keySeparator is off, so "domain.status.done" is one key (not domain → status → done).
    expect(i18n.t('domain.status.done')).toBe('Done');
  });
});
