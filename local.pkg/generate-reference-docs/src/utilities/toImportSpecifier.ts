/**
 * Converts a package.json exports subpath to an import specifier.
 *
 * @param packageName - The package name.
 * @param subpath - The exports subpath (e.g. `"."`, `"./utils"`).
 * @returns The full import specifier (e.g. `"@scope/pkg"`, `"@scope/pkg/utils"`).
 */
export function toImportSpecifier(packageName: string, subpath: string): string {
  if (subpath === '.') return packageName;
  if (subpath.startsWith('./')) return `${packageName}/${subpath.slice(2)}`;
  return `${packageName}/${subpath}`;
}
