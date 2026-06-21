import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // eslint-plugin-react-hooks 7 expands `recommended` with React-Compiler-era rules. Keep the
      // ESLint-10 bump behaviour-neutral by deferring the two that fire on existing, intentional
      // patterns (derive-state-on-prop-change in the collapse hooks; a ref write in Turnstile).
      // Adopting the full new ruleset is a deliberate follow-up.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/refs': 'off',
    },
  },
  {
    // shadcn/ui primitives legitimately export variants/helpers next to the component.
    files: ['src/components/ui/**/*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    // Playwright E2E specs + config run in Node, not the browser.
    files: ['e2e/**/*.ts', 'playwright.config.ts'],
    languageOptions: { globals: globals.node },
  },
);
