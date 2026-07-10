import {collectTypeReferences} from './collectTypeReferences.ts';

/**
 * Collects type references from multiple AST nodes and merges them.
 *
 * @param nodes - AST nodes to walk.
 * @returns Sorted deduplicated array of referenced type names, or undefined if none found.
 */
export function collectTypeRefsFromNodes(...nodes: any[]): string[] | undefined {
  const allRefs: string[] = [];
  for (const node of nodes) {
    if (node) allRefs.push(...collectTypeReferences(node));
  }
  const unique = [...new Set(allRefs)].sort();
  return unique.length > 0 ? unique : undefined;
}
