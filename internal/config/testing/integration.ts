import {defineConfig} from 'vitest/config';

/**
 * Shared vitest configuration for integration tests across all workspace packages.
 *
 * Each package's `vitest.integration.config.ts` merges this with its own vite config.
 */
export default defineConfig({
  test: {
    css: true,
    passWithNoTests: true,
    include: ['**/*.integration.ts', '**/*.integration.tsx'],
    exclude: ['**/.testing/**', '**/build/**', '**/node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: 'json-summary',
      reportsDirectory: '.testing/coverage/integration',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        '**/.testing/**',
        '**/*.bench.ts',
        '**/*.bench.tsx',
        '**/*.e2e.ts',
        '**/*.e2e.tsx',
        '**/*.integration.ts',
        '**/*.integration.tsx',
        '**/*.unit.ts',
        '**/*.unit.tsx',
        '**/build/**',
        '**/index.ts',
        '**/node_modules/**',
        '**/register.d.ts',
        '**/types/**',
      ],
    },
  },
});
