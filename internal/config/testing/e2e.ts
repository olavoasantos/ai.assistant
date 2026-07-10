import {defineConfig} from 'vitest/config';

/**
 * Shared vitest configuration for e2e tests across all workspace packages.
 *
 * Each package's `vitest.e2e.config.ts` merges this with its own vite config.
 */
export default defineConfig({
  test: {
    passWithNoTests: true,
    include: ['**/*.e2e.ts', '**/*.e2e.tsx'],
    exclude: ['**/.testing/**', '**/build/**', '**/node_modules/**'],
  },
});
