import type {MemberInfo, ParsedComment} from '../types.ts';
import {sliceBySpan} from './sliceBySpan.ts';
import {collectTypeReferences} from './collectTypeReferences.ts';
import {collectTypeRefsFromNodes} from './collectTypeRefsFromNodes.ts';
import {extractTypeParameters} from './extractTypeParameters.ts';
import {extractParameters} from './extractParameters.ts';
import {findLeadingDocBlock} from './findLeadingDocBlock.ts';
import {resolveAccessibility} from './resolveAccessibility.ts';

/**
 * Extracts a single member from an interface, class, or enum body node.
 *
 * @param member - The member AST node.
 * @param source - The full source text.
 * @param comments - All parsed comments from the file.
 * @returns Extracted member info, or null if the node type is not recognized.
 */
export function extractMember(
  member: any,
  source: string,
  comments: ParsedComment[],
): MemberInfo | null {
  const start = member.start ?? member.range?.[0];
  const docblock = start != null ? findLeadingDocBlock(source, start, comments) : undefined;
  const raw = sliceBySpan(source, member);

  switch (member.type) {
    case 'TSPropertySignature':
    case 'PropertyDefinition':
    case 'TSAbstractPropertyDefinition': {
      const name = member.key?.name ?? member.key?.value ?? sliceBySpan(source, member.key);
      const annotation = member.typeAnnotation?.typeAnnotation ?? member.typeAnnotation;
      const info: MemberInfo = {name, kind: 'property', raw};
      if (annotation) {
        info.type = sliceBySpan(source, annotation);
        const refs = collectTypeReferences(annotation);
        if (refs.length) info.referencedTypes = refs;
      }
      if (member.optional) info.optional = true;
      if (member.readonly) info.readonly = true;
      if (member.static) info.static = true;
      const accessibility = resolveAccessibility(member);
      if (accessibility) info.accessibility = accessibility;
      if (docblock) info.docblock = docblock;
      return info;
    }

    case 'TSMethodSignature':
    case 'MethodDefinition':
    case 'TSAbstractMethodDefinition': {
      const name = member.key?.name ?? member.key?.value ?? sliceBySpan(source, member.key);
      const fn = member.value ?? member;
      const params = fn.params?.params ?? fn.params ?? [];
      const info: MemberInfo = {
        name,
        kind: member.kind === 'get' ? 'getter' : member.kind === 'set' ? 'setter' : 'method',
        raw,
      };
      info.parameters = extractParameters(params, source);
      const returnAnnotation = fn.returnType?.typeAnnotation ?? fn.returnType;
      if (returnAnnotation) info.returnType = sliceBySpan(source, returnAnnotation);
      const methodTp = extractTypeParameters(fn, source) ?? extractTypeParameters(member, source);
      if (methodTp) info.typeParameters = methodTp;
      if (member.optional) info.optional = true;
      if (member.static) info.static = true;
      const methodAccessibility = resolveAccessibility(member);
      if (methodAccessibility) info.accessibility = methodAccessibility;
      if (docblock) info.docblock = docblock;
      const methodRefs = collectTypeRefsFromNodes(
        returnAnnotation,
        fn.typeParameters ?? member.typeParameters,
      );
      if (methodRefs) info.referencedTypes = methodRefs;
      return info;
    }

    case 'TSIndexSignature': {
      const annotation = member.typeAnnotation?.typeAnnotation ?? member.typeAnnotation;
      const info: MemberInfo = {
        name: '[index]',
        kind: 'index-signature',
        type: sliceBySpan(source, annotation),
        readonly: member.readonly ?? false,
        docblock,
        raw,
      };
      const refs = collectTypeRefsFromNodes(annotation);
      if (refs) info.referencedTypes = refs;
      return info;
    }

    case 'TSCallSignatureDeclaration': {
      const params = member.params?.params ?? member.params ?? [];
      const returnAnnotation = member.returnType?.typeAnnotation ?? member.returnType;
      const info: MemberInfo = {
        name: '()',
        kind: 'call-signature',
        parameters: extractParameters(params, source),
        returnType: sliceBySpan(source, returnAnnotation),
        docblock,
        raw,
      };
      const tp = extractTypeParameters(member, source);
      if (tp) info.typeParameters = tp;
      const refs = collectTypeRefsFromNodes(returnAnnotation, member.typeParameters);
      if (refs) info.referencedTypes = refs;
      return info;
    }

    case 'TSConstructSignatureDeclaration': {
      const params = member.params?.params ?? member.params ?? [];
      const returnAnnotation = member.returnType?.typeAnnotation ?? member.returnType;
      const info: MemberInfo = {
        name: 'new()',
        kind: 'construct-signature',
        parameters: extractParameters(params, source),
        returnType: sliceBySpan(source, returnAnnotation),
        docblock,
        raw,
      };
      const tp = extractTypeParameters(member, source);
      if (tp) info.typeParameters = tp;
      const refs = collectTypeRefsFromNodes(returnAnnotation, member.typeParameters);
      if (refs) info.referencedTypes = refs;
      return info;
    }

    case 'TSEnumMember': {
      const name = member.id?.name ?? member.id?.value ?? sliceBySpan(source, member.id);
      return {
        name,
        kind: 'enum-member',
        value: member.initializer ? sliceBySpan(source, member.initializer) : undefined,
        docblock,
        raw,
      };
    }

    default:
      return null;
  }
}
