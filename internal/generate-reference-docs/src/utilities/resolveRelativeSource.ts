import {existsSync, statSync} from 'node:fs';
import {dirname, relative, resolve} from 'node:path';
import {RESOLVE_EXTENSIONS} from '../constants.ts';

/**
 * Resolves a relative import specifier to a file path relative to sourceDir.
 * Tries common TypeScript extensions if the exact path doesn't exist.
 *
 * @param specifier - The relative import specifier.
 * @param filePath - Absolute path of the importing file.
 * @param sourceDir - Root source directory for relative path resolution.
 * @returns The resolved path relative to sourceDir.
 */
export function resolveRelativeSource(
  specifier: string,
  filePath: string,
  sourceDir: string,
): string {
  const fileDir = dirname(filePath);
  const absolute = resolve(fileDir, specifier);

  if (existsSync(absolute) && !statSync(absolute).isDirectory()) {
    return relative(sourceDir, absolute);
  }

  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = absolute + ext;
    if (existsSync(candidate)) {
      return relative(sourceDir, candidate);
    }
  }

  return relative(sourceDir, absolute);
}
