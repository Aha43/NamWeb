import { APP_ENV, type AppEnv } from './env';

/**
 * In any non-production environment, swap to the yellow "working" favicon and tag
 * the tab title with the environment — so you can tell at a glance whether a tab is
 * showing local/dev vs the real prod site. No-op in production.
 */
export function applyEnvChrome(env: AppEnv = APP_ENV, doc: Document = document): void {
  if (env === 'production') return;
  const link = doc.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (link) link.setAttribute('href', '/favicon-dev.svg');
  doc.title = `${doc.title} [${env}]`;
}
