import {BUILTIN_TYPES} from '../constants.ts';
import {resolveTypeName} from './resolveTypeName.ts';

/**
 * Recursively walks an AST node and collects referenced type names into a set.
 *
 * @param node - The AST node to walk.
 * @param refs - Mutable set to add discovered type names to.
 */
export function walkForTypeRefs(node: any, refs: Set<string>): void {
  if (!node || typeof node !== 'object') return;

  if (node.type === 'TSTypeReference') {
    const name = resolveTypeName(node.typeName);
    if (name && !BUILTIN_TYPES.has(name)) {
      refs.add(name);
    }
    if (node.typeArguments || node.typeParameters) {
      walkForTypeRefs(node.typeArguments ?? node.typeParameters, refs);
    }
    return;
  }

  if (node.type === 'TSTypeQuery') {
    const name = resolveTypeName(node.exprName);
    if (name && !BUILTIN_TYPES.has(name)) {
      refs.add(name);
    }
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      walkForTypeRefs(item, refs);
    }
    return;
  }

  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'start' || key === 'end' || key === 'range' || key === 'loc') {
      continue;
    }
    const child = node[key];
    if (child && typeof child === 'object') {
      walkForTypeRefs(child, refs);
    }
  }
}
