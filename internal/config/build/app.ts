import {defineConfig} from 'vite';

/**
 * Creates a shared Vite configuration for application builds.
 *
 * Handles web apps, documentation sites, and similar non-library builds.
 * Unlike the package config, this produces a bundled output (no preserveModules,
 * no DTS, no dual CJS/ESM) and includes minification.
 */
export function createAppViteConfig(options: {
  /** The app's `package.json` as an object (for version define). */
  pkg: {version: string; name: string};
  /**
   * Vite plugins to include (e.g. `preact()`, `tailwindcss()`).
   * Passed directly to the `plugins` array.
   */
  plugins?: Parameters<typeof defineConfig>[0] extends infer C
    ? C extends {plugins?: infer P}
      ? P
      : never
    : never;
}) {
  const {pkg, plugins = []} = options;

  return defineConfig({
    define: {
      ['process.env.PACKAGE_VERSION']: JSON.stringify(pkg.version),
    },
    build: {
      emptyOutDir: true,
      sourcemap: true,
      minify: 'terser',
    },

    test: {name: pkg.name},

    plugins: [...(Array.isArray(plugins) ? plugins : [plugins])],
  });
}
