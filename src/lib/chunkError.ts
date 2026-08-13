/**
 * True for the browser-specific "a dynamically imported module failed to load" errors. After a
 * deploy, an already-open tab still holds the old hashed chunk URLs — they 404, and `React.lazy`
 * re-throws the rejection during render. Only the code-split Focus route is lazy (everything else
 * lives in the main bundle), which is why Focus alone would blank until a manual refresh (#1108).
 * The message text varies by engine, so we match the union.
 */
export function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error ?? '');
  return /dynamically imported module|importing a module script failed|chunkloaderror|failed to fetch/i.test(msg);
}
