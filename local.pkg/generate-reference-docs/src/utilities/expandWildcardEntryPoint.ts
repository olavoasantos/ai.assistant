import {existsSync} from 'node:fs';
import {relative, resolve} from 'node:path';
import type {WildcardMatch} from '../types.ts';
import {findTsFiles} from './findTsFiles.ts';

/**
 * Expands a wildcard entry point pattern into matching source files.
 *
 * In package.json exports, `*` matches across path segments, so
 * `./*: ./src/*.d.ts` means `*` can capture `"utilities/formatDate"`
 * to resolve to `./src/utilities/formatDate.d.ts`.
 *
 * @param entryPath - The entry point path pattern containing `*`.
 * @param packageDir - The package directory.
 * @returns The original pattern and array of matched files with captured stems.
 */
export function expandWildcardEntryPoint(
  entryPath: string,
  packageDir: string,
): {pattern: string; matches: WildcardMatch[]} {
  if (!entryPath.includes('*')) return {pattern: entryPath, matches: []};

  const absolute = resolve(packageDir, entryPath);
  const starIndex = absolute.indexOf('*');

  const beforeStar = absolute.slice(0, starIndex);
  const afterStar = absolute.slice(starIndex + 1);

  const lastSlash = beforeStar.lastIndexOf('/');
  const baseDir = beforeStar.slice(0, lastSlash);
  const filePrefix = beforeStar.slice(lastSlash + 1);

  const candidateDirs = [baseDir];
  for (const [from, to] of [
    ['/dist/', '/src/'],
    ['/build/', '/src/'],
    ['/out/', '/src/'],
  ]) {
    if (baseDir.includes(String(from))) {
      candidateDirs.push(baseDir.replace(String(from), String(to)));
    }
  }

  const suffixVariants = new Set([afterStar]);
  if (afterStar.endsWith('.js')) {
    suffixVariants.add(afterStar.replace(/\.js$/, '.ts'));
    suffixVariants.add(afterStar.replace(/\.js$/, '.tsx'));
  }
  if (afterStar.endsWith('.mjs')) {
    suffixVariants.add(afterStar.replace(/\.mjs$/, '.mts'));
    suffixVariants.add(afterStar.replace(/\.mjs$/, '.ts'));
  }
  if (afterStar.endsWith('.d.ts')) {
    suffixVariants.add(afterStar.replace(/\.d\.ts$/, '.ts'));
    suffixVariants.add(afterStar.replace(/\.d\.ts$/, '.tsx'));
  }
  if (afterStar.endsWith('.d.mts')) {
    suffixVariants.add(afterStar.replace(/\.d\.mts$/, '.mts'));
    suffixVariants.add(afterStar.replace(/\.d\.mts$/, '.ts'));
  }

  const matches: WildcardMatch[] = [];
  const seen = new Set<string>();

  for (const dir of candidateDirs) {
    if (!existsSync(dir)) continue;

    const allFiles = findTsFiles(dir);
    for (const fullPath of allFiles) {
      const relToBase = relative(dir, fullPath);
      if (filePrefix && !relToBase.startsWith(filePrefix)) continue;

      let matchedSuffix: string | null = null;
      for (const sfx of suffixVariants) {
        if (!sfx || fullPath.endsWith(sfx)) {
          matchedSuffix = sfx;
          break;
        }
      }
      if (matchedSuffix === null) continue;

      let stem = relToBase;
      if (filePrefix) stem = stem.slice(filePrefix.length);
      if (matchedSuffix) stem = stem.slice(0, stem.length - matchedSuffix.length);

      if (!seen.has(fullPath)) {
        seen.add(fullPath);
        matches.push({filePath: fullPath, stem});
      }
    }

    if (matches.length > 0) break;
  }

  matches.sort((a, b) => a.filePath.localeCompare(b.filePath));
  return {pattern: entryPath, matches};
}
