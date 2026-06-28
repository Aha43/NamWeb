/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Release version comes from package.json (single source of truth); the build's commit SHA comes
// from Cloudflare Pages' build env (empty for a local dev build). Both are baked in at build time
// and surfaced via src/lib/env.ts. See #464.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string;
};
const buildSha = process.env.CF_PAGES_COMMIT_SHA ?? '';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_SHA__: JSON.stringify(buildSha),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Unit/component tests live under src (plus the standalone mcp/ server);
    // e2e/ is Playwright's, not Vitest's.
    include: ['src/**/*.{test,spec}.{ts,tsx}', 'mcp/**/*.{test,spec}.ts'],
    // Deterministic Supabase env so modules importing the client don't throw under test.
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    },
  },
});
