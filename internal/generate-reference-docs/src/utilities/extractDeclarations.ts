import type {Declaration, ParsedComment} from '../types.ts';
import {extractNode} from './extractNode.ts';

/**
 * Walks the top-level body of a program or namespace and extracts declarations.
 *
 * @param body - Array of AST statement nodes.
 * @param source - The full source text.
 * @param comments - All parsed comments from the file.
 * @param exportedNames - Mutable set to track re-exported names.
 * @returns Array of extracted declarations.
 */
export function extractDeclarations(
  body: any[],
  source: string,
  comments: ParsedComment[],
  exportedNames?: Set<string>,
): Declaration[] {
  const declarations: Declaration[] = [];
  for (const node of body) {
    const extracted = extractNode(node, source, comments, exportedNames);
    if (extracted) {
      declarations.push(...(Array.isArray(extracted) ? extracted : [extracted]));
    }
  }
  return declarations;
}
