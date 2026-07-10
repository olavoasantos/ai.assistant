import {sliceBySpan} from './sliceBySpan.ts';

/**
 * Extracts a parameter's name from its AST node.
 *
 * Handles identifiers, object patterns, and array patterns.
 *
 * @param node - The parameter AST node.
 * @param source - The full source text.
 * @returns The extracted parameter name string.
 */
export function extractParamName(node: any, source: string): string {
  if (!node) return '<unknown>';
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'ObjectPattern' || node.type === 'ArrayPattern') {
    return sliceBySpan(source, node);
  }
  return node.name ?? sliceBySpan(source, node) ?? '<unknown>';
}
