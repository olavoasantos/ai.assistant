import type {ParameterInfo} from '../types.ts';
import {sliceBySpan} from './sliceBySpan.ts';
import {collectTypeReferences} from './collectTypeReferences.ts';
import {extractParamName} from './extractParamName.ts';

/**
 * Extracts parameter information from a function/method's parameter list.
 *
 * @param params - Array of parameter AST nodes.
 * @param source - The full source text.
 * @returns Array of extracted parameter info.
 */
export function extractParameters(params: any[], source: string): ParameterInfo[] {
  return params.map((p: any) => {
    const info: ParameterInfo = {name: extractParamName(p, source)};

    const annotation = p.typeAnnotation?.typeAnnotation ?? p.typeAnnotation;
    if (annotation) {
      info.type = sliceBySpan(source, annotation);
      const refs = collectTypeReferences(annotation);
      if (refs.length) info.referencedTypes = refs;
    }

    if (p.optional) info.optional = true;

    if (p.type === 'RestElement') {
      info.rest = true;
      info.name = extractParamName(p.argument ?? p, source);
      const restAnnotation =
        p.argument?.typeAnnotation?.typeAnnotation ??
        p.typeAnnotation?.typeAnnotation ??
        p.typeAnnotation;
      if (restAnnotation) {
        info.type = sliceBySpan(source, restAnnotation);
        const refs = collectTypeReferences(restAnnotation);
        if (refs.length) info.referencedTypes = refs;
      }
    }

    if (p.type === 'AssignmentPattern') {
      info.name = extractParamName(p.left, source);
      info.default = sliceBySpan(source, p.right);
      const assignAnnotation = p.left?.typeAnnotation?.typeAnnotation ?? p.left?.typeAnnotation;
      if (assignAnnotation) {
        info.type = sliceBySpan(source, assignAnnotation);
        const refs = collectTypeReferences(assignAnnotation);
        if (refs.length) info.referencedTypes = refs;
      }
    }

    return info;
  });
}
