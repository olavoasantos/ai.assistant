/**
 * Resolves the exports field of a package.json, recursively walking
 * conditional objects and subpath mappings.
 *
 * @param exports - The exports field value (string, array, or object).
 * @param currentPath - The current subpath being resolved.
 * @param entries - Mutable map to add resolved subpath → file path entries.
 */
export function collectExports(
  exports: any,
  currentPath: string,
  entries: Map<string, string>,
): void {
  if (typeof exports === 'string') {
    entries.set(currentPath, exports);
    return;
  }

  if (Array.isArray(exports)) {
    if (exports.length > 0) collectExports(exports[0], currentPath, entries);
    return;
  }

  if (typeof exports === 'object' && exports !== null) {
    const keys = Object.keys(exports);
    const conditionKeys = new Set([
      'import',
      'require',
      'types',
      'default',
      'node',
      'browser',
      'development',
      'production',
    ]);
    const isConditions = keys.some((k) => conditionKeys.has(k));

    if (isConditions) {
      const resolved =
        exports.types ?? exports.import ?? exports.default ?? exports[keys[0] as string];
      if (resolved) collectExports(resolved, currentPath, entries);
    } else {
      for (const [subpath, value] of Object.entries(exports)) {
        const fullPath = subpath === '.' ? currentPath : subpath;
        collectExports(value, fullPath, entries);
      }
    }
  }
}
