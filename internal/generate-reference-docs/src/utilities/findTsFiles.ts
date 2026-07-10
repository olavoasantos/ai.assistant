import {readdirSync} from 'node:fs';
import {join, extname} from 'node:path';
import {TS_EXTENSIONS, SKIP_DIRS} from '../constants.ts';

/**
 * Recursively finds all TypeScript source files in a directory.
 *
 * @param dir - The directory to scan.
 * @returns Sorted array of absolute file paths.
 */
export function findTsFiles(dir: string): string[] {
  const results: string[] = [];

  function walk(current: string) {
    const entries = readdirSync(current, {withFileTypes: true});
    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(fullPath);
      } else if (entry.isFile() && TS_EXTENSIONS.has(extname(entry.name))) {
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results.toSorted();
}
