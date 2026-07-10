import {walkForTypeRefs} from './walkForTypeRefs.ts';

/**
 * Recursively walks an AST node and collects all type names referenced
 * via TSTypeReference. Returns a deduplicated, sorted array excluding built-ins.
 *
 * @param node - The AST node to walk.
 * @returns Sorted array of referenced type names.
 */
export function collectTypeReferences(node: any): string[] {
  const refs = new Set<string>();
  walkForTypeRefs(node, refs);
  return [...refs].sort();
}
