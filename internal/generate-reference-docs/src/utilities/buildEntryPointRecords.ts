import {relative} from 'node:path';
import type {EntryPoint} from '../types.ts';
import {expandWildcardEntryPoint} from './expandWildcardEntryPoint.ts';
import {resolveEntryPointToSource} from './resolveEntryPointToSource.ts';
import {traceFile} from './traceFile.ts';

/**
 * Builds EntryPoint records for the extraction result output.
 *
 * @param entryPoints - Map of subpath → file path from package.json exports.
 * @param packageDir - The package directory.
 * @param sourceDir - The source directory.
 * @returns Array of entry point records with resolved paths and exported names.
 */
export function buildEntryPointRecords(
  entryPoints: Map<string, string>,
  packageDir: string,
  sourceDir: string,
): EntryPoint[] {
  const records: EntryPoint[] = [];

  for (const [subpath, entryPath] of entryPoints) {
    if (entryPath.includes('*')) {
      const {matches} = expandWildcardEntryPoint(entryPath, packageDir);
      if (matches.length === 0) {
        records.push({subpath, resolvedPaths: [entryPath], exportedNames: []});
        continue;
      }

      for (const {filePath, stem} of matches) {
        const concreteSubpath = subpath.replace('*', stem);
        const localPublic = new Map<string, Set<string>>();
        traceFile(filePath, '*', localPublic, new Set());

        const allNames = new Set<string>();
        for (const names of localPublic.values()) {
          for (const name of names) allNames.add(name);
        }

        records.push({
          subpath: concreteSubpath,
          resolvedPaths: [relative(sourceDir, filePath)],
          exportedNames: [...allNames].toSorted(),
        });
      }
    } else {
      const resolved = resolveEntryPointToSource(entryPath, packageDir);
      if (!resolved) {
        records.push({subpath, resolvedPaths: [entryPath], exportedNames: []});
        continue;
      }

      const localPublic = new Map<string, Set<string>>();
      traceFile(resolved, '*', localPublic, new Set());

      const allNames = new Set<string>();
      for (const names of localPublic.values()) {
        for (const name of names) allNames.add(name);
      }

      records.push({
        subpath,
        resolvedPaths: [relative(sourceDir, resolved)],
        exportedNames: [...allNames].toSorted(),
      });
    }
  }

  return records;
}
