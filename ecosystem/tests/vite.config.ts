import {defineConfig} from 'vite';
import dts from 'vite-plugin-dts';
import pkg from './package.json' with {type: 'json'};

export default defineConfig({
  define: {
    ['process.env.PACKAGE_VERSION']: JSON.stringify(pkg.version),
  },
  build: {
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: {
        index: 'index.ts',
        'error/index': 'error/index.ts',
        'error/mocks': 'error/mocks.ts',
      },
    },
    rollupOptions: {
      external: [/^node:/, /^@ai\.assistant/g, /vitest/],
      output: [
        {
          format: 'es',
          preserveModules: true,
          entryFileNames: (chunkInfo) => {
            const cleanName = chunkInfo.name.replace(/\.css[?_]inline/g, '');
            return `${cleanName}.js`;
          },
          chunkFileNames: (chunkInfo) => {
            const cleanName = chunkInfo.name.replace(/\.css[?_]inline/g, '');
            return `${cleanName}.js`;
          },
        },
        {
          format: 'cjs',
          preserveModules: true,
          entryFileNames: (chunkInfo) => {
            const cleanName = chunkInfo.name.replace(/\.css[?_]inline/g, '');
            return `${cleanName}.cjs`;
          },
          chunkFileNames: (chunkInfo) => {
            const cleanName = chunkInfo.name.replace(/\.css[?_]inline/g, '');
            return `${cleanName}.cjs`;
          },
        },
      ],
    },
  },

  test: {name: pkg.name},

  plugins: [
    dts({
      entryRoot: '.',
      exclude: [
        'vite.*.ts',
        'vitest.*.ts',
        '**/specs/**',
        'dist/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        '**/*.unit.ts',
        '**/*.unit.tsx',
        '**/*.integration.ts',
        '**/*.integration.tsx',
        '**/*.e2e.ts',
        '**/*.e2e.tsx',
        '.ignore/**',
      ],
    }),
  ],
});
