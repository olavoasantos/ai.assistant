import type {Declaration} from '../types.ts';

/**
 * Filters declarations to only include exported ones.
 * Ambient declarations (`declare global`, `declare module`) are always included.
 * Namespaces are included if they or their children are exported.
 *
 * @param declarations - Array of declarations to filter.
 * @returns Filtered array containing only exported declarations.
 */
export function filterExported(declarations: Declaration[]): Declaration[] {
  return declarations.flatMap((d) => {
    if (d.ambient) return [d];
    if (d.kind === 'namespace' || d.kind === 'module') {
      const filteredChildren = d.declarations ? filterExported(d.declarations) : [];
      if (d.exported || filteredChildren.length > 0) {
        return [{...d, declarations: filteredChildren}];
      }
      return [];
    }
    return d.exported ? [d] : [];
  });
}
