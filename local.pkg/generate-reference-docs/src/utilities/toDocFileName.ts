/**
 * Converts a package.json exports subpath to a documentation filename.
 *
 * @param subpath - The exports subpath (e.g. `"."`, `"./utils"`).
 * @returns The documentation filename (e.g. `"README.md"`, `"utils.md"`).
 */
export function toDocFileName(subpath: string): string {
  if (subpath === '.') return 'README.md';
  const normalized = subpath.replace(/^\.\//, '').replace(/\//g, '-');
  return `${normalized}.md`;
}
