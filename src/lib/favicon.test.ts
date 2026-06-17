import { describe, expect, it } from 'vitest';
import { applyEnvChrome } from './favicon';

function docWithIcon(): Document {
  const doc = document.implementation.createHTMLDocument('Next Action Master');
  const link = doc.createElement('link');
  link.rel = 'icon';
  link.setAttribute('href', '/favicon.svg');
  doc.head.appendChild(link);
  return doc;
}

describe('applyEnvChrome', () => {
  it('leaves the favicon and title untouched in production', () => {
    const doc = docWithIcon();
    applyEnvChrome('production', doc);
    expect(doc.querySelector('link[rel="icon"]')?.getAttribute('href')).toBe('/favicon.svg');
    expect(doc.title).toBe('Next Action Master');
  });

  it('swaps to the dev favicon and tags the title outside production', () => {
    const doc = docWithIcon();
    applyEnvChrome('development', doc);
    expect(doc.querySelector('link[rel="icon"]')?.getAttribute('href')).toBe('/favicon-dev.svg');
    expect(doc.title).toBe('Next Action Master [development]');
  });
});
