import type {Declaration} from '../types.ts';

/**
 * Recursively counts declarations including nested ones in namespaces/modules.
 *
 * @param declarations - Array of declarations to count.
 * @returns Total count of declarations.
 */
export function countDeclarations(declarations: Declaration[]): number {
  let count = 0;
  for (const d of declarations) {
    count += 1;
    if (d.declarations) count += countDeclarations(d.declarations);
  }
  return count;
}
