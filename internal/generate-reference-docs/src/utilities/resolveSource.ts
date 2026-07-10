import {existsSync, statSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {RESOLVE_EXTENSIONS} from '../constants.ts';
import {isRelativeImport} from './isRelativeImport.ts';

/**
 * Resolves an import source to an absolute file path, trying common
 * TypeScript extensions. Non-relative specifiers are returned as-is.
 *
 * @param rawSource - The raw import specifier.
 * @param filePath - Absolute path of the importing file.
 * @returns The resolved absolute file path.
 */
export function resolveSource(rawSource: string, filePath: string): string {
  if (!isRelativeImport(rawSource)) return rawSource;

  const absolute = resolve(dirname(filePath), rawSource);
  for (const ext of ['', ...RESOLVE_EXTENSIONS]) {
    const candidate = absolute + ext;
    if (existsSync(candidate) && !statSync(candidate).isDirectory()) {
      return candidate;
    }
  }
  return absolute;
}
