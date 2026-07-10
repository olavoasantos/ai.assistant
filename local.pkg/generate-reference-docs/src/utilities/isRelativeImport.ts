/**
 * Checks whether a module specifier is a relative path.
 *
 * @param specifier - The import module specifier.
 * @returns True if the specifier starts with `./` or `../`.
 */
export function isRelativeImport(specifier: string): boolean {
  return specifier.startsWith('./') || specifier.startsWith('../');
}
