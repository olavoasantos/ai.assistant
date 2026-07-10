import {resolveEntryPointToSource} from './resolveEntryPointToSource.ts';
import {expandWildcardEntryPoint} from './expandWildcardEntryPoint.ts';
import {traceFile} from './traceFile.ts';

/**
 * Traces all public API declarations reachable from package.json entry points.
 *
 * @param entryPoints - Map of subpath → file path from package.json exports.
 * @param packageDir - The package directory.
 * @returns Map of absolute file path → set of exported names.
 */
export function tracePublicApi(
  entryPoints: Map<string, string>,
  packageDir: string,
): Map<string, Set<string>> {
  const publicFiles = new Map<string, Set<string>>();
  const visited = new Set<string>();

  for (const [, entryPath] of entryPoints) {
    if (entryPath.includes('*')) {
      const {matches} = expandWildcardEntryPoint(entryPath, packageDir);
      for (const {filePath} of matches) {
        traceFile(filePath, '*', publicFiles, visited);
      }
    } else {
      const resolved = resolveEntryPointToSource(entryPath, packageDir);
      if (!resolved) continue;
      traceFile(resolved, '*', publicFiles, visited);
    }
  }

  return publicFiles;
}
