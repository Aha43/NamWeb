import { APP_VERSION, BUILD_SHA } from '@/lib/env';
import { cn } from '@/lib/utils';

const REPO_URL = 'https://github.com/Aha43/NamWeb';

/**
 * Muted "NamWeb v0.1.0 · a1b2c3d" stamp. The short SHA links to the build's GitHub commit so a
 * Cloudflare preview is identifiable at a glance; a local dev build (no CF SHA) shows "dev". See #464.
 */
export function VersionBadge({ className }: { className?: string }) {
  const short = BUILD_SHA ? BUILD_SHA.slice(0, 7) : 'dev';
  return (
    <p className={cn('text-xs text-muted-foreground', className)}>
      NamWeb <span className="tabular-nums">v{APP_VERSION}</span>
      {' · '}
      {BUILD_SHA ? (
        <a
          href={`${REPO_URL}/commit/${BUILD_SHA}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono hover:text-foreground hover:underline"
        >
          {short}
        </a>
      ) : (
        <span className="font-mono">{short}</span>
      )}
    </p>
  );
}
