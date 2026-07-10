import {existsSync} from 'node:fs';
import {analyzeFileExports} from './analyzeFileExports.ts';

/**
 * Recursively traces exports from a file into the public API map.
 *
 * @param filePath - Absolute path to the file.
 * @param requestedName - Specific name to trace, or `'*'` for all exports.
 * @param publicFiles - Mutable map accumulating public file → names.
 * @param visited - Set of already-visited trace keys to prevent cycles.
 */
export function traceFile(
  filePath: string,
  requestedName: string,
  publicFiles: Map<string, Set<string>>,
  visited: Set<string>,
): void {
  const visitKey = `${filePath}::${requestedName}`;
  if (visited.has(visitKey)) return;
  visited.add(visitKey);

  if (!existsSync(filePath)) return;

  const {localExports, reExports} = analyzeFileExports(filePath);

  if (!publicFiles.has(filePath)) publicFiles.set(filePath, new Set());
  const filePublicNames = publicFiles.get(filePath)!;

  if (requestedName === '*') {
    for (const name of localExports) filePublicNames.add(name);
    for (const reExport of reExports) {
      if (!existsSync(reExport.source)) continue;
      if (reExport.star) {
        traceFile(reExport.source, '*', publicFiles, visited);
      } else {
        for (const name of reExport.names) {
          traceFile(reExport.source, name, publicFiles, visited);
        }
      }
    }
  } else {
    if (localExports.has(requestedName)) {
      filePublicNames.add(requestedName);
    } else {
      for (const reExport of reExports) {
        if (!existsSync(reExport.source)) continue;
        if (reExport.star) {
          traceFile(reExport.source, requestedName, publicFiles, visited);
        } else if (reExport.names.includes(requestedName)) {
          let originalName = requestedName;
          for (const [from, to] of reExport.renames) {
            if (to === requestedName) {
              originalName = from;
              break;
            }
          }
          traceFile(reExport.source, originalName, publicFiles, visited);
        }
      }
    }
  }
}
