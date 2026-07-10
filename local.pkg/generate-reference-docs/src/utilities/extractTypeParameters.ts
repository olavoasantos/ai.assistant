import type {TypeParameter} from '../types.ts';
import {sliceBySpan} from './sliceBySpan.ts';

/**
 * Extracts type parameters from a generic declaration AST node.
 *
 * @param node - An AST node that may have typeParameters.
 * @param source - The full source text.
 * @returns Array of type parameters, or undefined if none.
 */
export function extractTypeParameters(node: any, source: string): TypeParameter[] | undefined {
  const params = node.typeParameters?.params ?? node.typeParameters?.body;
  if (!params?.length) return undefined;

  return params.map((tp: any) => {
    const result: TypeParameter = {
      name: tp.name?.name ?? tp.name ?? sliceBySpan(source, tp.name),
    };
    if (tp.constraint) result.constraint = sliceBySpan(source, tp.constraint);
    if (tp.default) result.default = sliceBySpan(source, tp.default);
    return result;
  });
}
