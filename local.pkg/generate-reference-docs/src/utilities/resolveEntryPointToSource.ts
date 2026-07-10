import {existsSync} from 'node:fs';
import {extname, resolve} from 'node:path';
import {TS_EXTENSIONS, RESOLVE_EXTENSIONS} from '../constants.ts';

/**
 * Resolves a package.json export entry point path to an actual source file.
 * Handles common patterns like `dist → src` swaps and extension resolution.
 *
 * @param entryPath - The entry point path from package.json exports.
 * @param packageDir - The package directory.
 * @returns The resolved absolute source file path, or null if not found.
 */
export function resolveEntryPointToSource(entryPath: string, packageDir: string): string | null {
  const absolute = resolve(packageDir, entryPath);
  const isDeclarationFile = /\.d\.(ts|mts|cts)$/.test(absolute);
  const isSourceTsFile = TS_EXTENSIONS.has(extname(absolute)) && !isDeclarationFile;

  if (isSourceTsFile && existsSync(absolute)) return absolute;

  const tsSwaps = isDeclarationFile
    ? []
    : [absolute.replace(/\.(js|mjs|cjs)$/, '.ts'), absolute.replace(/\.(js|mjs|cjs)$/, '.tsx')];

  for (const candidate of tsSwaps) {
    if (existsSync(candidate)) return candidate;
  }

  const srcVariants = [
    absolute.replace(/\/dist\//, '/src/').replace(/\.(js|mjs|cjs|d\.ts|d\.mts|d\.cts)$/, '.ts'),
    absolute.replace(/\/dist\//, '/src/').replace(/\.(js|mjs|cjs|d\.ts|d\.mts|d\.cts)$/, '.tsx'),
    absolute.replace(/\/build\//, '/src/').replace(/\.(js|mjs|cjs|d\.ts|d\.mts|d\.cts)$/, '.ts'),
    absolute.replace(/\/out\//, '/src/').replace(/\.(js|mjs|cjs|d\.ts|d\.mts|d\.cts)$/, '.ts'),
  ];

  for (const candidate of srcVariants) {
    if (existsSync(candidate)) return candidate;
  }

  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = absolute + ext;
    if (existsSync(candidate)) return candidate;
  }

  return null;
}
