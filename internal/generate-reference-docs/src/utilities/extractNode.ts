import type {Declaration, DeclarationKind, ParsedComment} from '../types.ts';
import {sliceBySpan} from './sliceBySpan.ts';
import {collectTypeReferences} from './collectTypeReferences.ts';
import {collectTypeRefsFromNodes} from './collectTypeRefsFromNodes.ts';
import {extractTypeParameters} from './extractTypeParameters.ts';
import {extractParameters} from './extractParameters.ts';
import {extractMembers} from './extractMembers.ts';
import {findLeadingDocBlock} from './findLeadingDocBlock.ts';
import {extractDeclarations} from './extractDeclarations.ts';

/**
 * Extracts a single AST statement node into a Declaration or array of Declarations.
 *
 * Handles export wrappers, type aliases, interfaces, enums, classes,
 * functions, variables, and module/namespace declarations.
 *
 * @param node - The AST statement node.
 * @param source - The full source text.
 * @param comments - All parsed comments from the file.
 * @param exportedNames - Mutable set to track re-exported names.
 * @returns Extracted declaration(s), or null if the node is not a declaration.
 */
export function extractNode(
  node: any,
  source: string,
  comments: ParsedComment[],
  exportedNames?: Set<string>,
): Declaration | Declaration[] | null {
  if (!node) return null;
  const nodeStart = node.start ?? node.range?.[0];

  switch (node.type) {
    case 'ExportNamedDeclaration': {
      if (node.declaration) {
        const inner = extractNode(node.declaration, source, comments, exportedNames);
        if (inner) {
          const items = Array.isArray(inner) ? inner : [inner];
          for (const d of items) d.exported = true;
          return items;
        }
      }
      if (node.specifiers && exportedNames) {
        for (const spec of node.specifiers) {
          const name = spec.exported?.name ?? spec.local?.name;
          if (name) exportedNames.add(name);
        }
      }
      return null;
    }

    case 'ExportDefaultDeclaration': {
      if (node.declaration) {
        const inner = extractNode(node.declaration, source, comments, exportedNames);
        if (inner && !Array.isArray(inner)) {
          inner.exported = true;
          if (!inner.name) inner.name = 'default';
        }
        return inner;
      }
      return null;
    }

    case 'TSTypeAliasDeclaration': {
      const decl: Declaration = {
        kind: 'type',
        name: node.id?.name ?? '',
        exported: false,
        raw: sliceBySpan(source, node),
      };
      decl.typeParameters = extractTypeParameters(node, source) ?? [];
      if (node.typeAnnotation) decl.value = sliceBySpan(source, node.typeAnnotation);
      decl.docblock = findLeadingDocBlock(source, nodeStart, comments)!;
      const refs = collectTypeRefsFromNodes(node.typeAnnotation, node.typeParameters);
      if (refs) decl.referencedTypes = refs;
      return decl;
    }

    case 'TSInterfaceDeclaration': {
      const decl: Declaration = {
        kind: 'interface',
        name: node.id?.name ?? '',
        exported: false,
        raw: sliceBySpan(source, node),
      };
      decl.typeParameters = extractTypeParameters(node, source)!;
      if (node.extends?.length) {
        decl.extends = node.extends.map((e: any) => sliceBySpan(source, e));
      }
      decl.members = extractMembers(node.body?.body ?? [], source, comments);
      decl.docblock = findLeadingDocBlock(source, nodeStart, comments)!;
      const refs = collectTypeRefsFromNodes(...(node.extends ?? []), node.typeParameters);
      if (refs) decl.referencedTypes = refs;
      return decl;
    }

    case 'TSEnumDeclaration': {
      const decl: Declaration = {
        kind: 'enum',
        name: node.id?.name ?? '',
        exported: false,
        raw: sliceBySpan(source, node),
      };
      decl.members = extractMembers(node.body?.members ?? node.members ?? [], source, comments);
      decl.docblock = findLeadingDocBlock(source, nodeStart, comments)!;
      return decl;
    }

    case 'ClassDeclaration': {
      const decl: Declaration = {
        kind: 'class',
        name: node.id?.name ?? '',
        exported: false,
        raw: sliceBySpan(source, node),
      };
      decl.typeParameters = extractTypeParameters(node, source)!;
      if (node.superClass) {
        const ext = sliceBySpan(source, node.superClass);
        const typeArgs = node.superTypeParameters
          ? sliceBySpan(source, node.superTypeParameters)
          : '';
        decl.extends = [ext + typeArgs];
      }
      if (node.implements?.length) {
        decl.implements = node.implements.map((i: any) => sliceBySpan(source, i));
      }
      decl.members = extractMembers(node.body?.body ?? [], source, comments);
      decl.docblock = findLeadingDocBlock(source, nodeStart, comments)!;
      const refs = collectTypeRefsFromNodes(
        node.superClass,
        node.superTypeParameters,
        ...(node.implements ?? []),
        node.typeParameters,
      );
      if (refs) decl.referencedTypes = refs;
      return decl;
    }

    case 'FunctionDeclaration':
    case 'TSDeclareFunction': {
      const decl: Declaration = {
        kind: 'function',
        name: node.id?.name ?? '',
        exported: false,
        raw: sliceBySpan(source, node),
      };
      decl.typeParameters = extractTypeParameters(node, source)!;
      const params = node.params?.params ?? node.params ?? [];
      decl.parameters = extractParameters(params, source);
      const retAnnotation = node.returnType?.typeAnnotation ?? node.returnType;
      if (retAnnotation) decl.returnType = sliceBySpan(source, retAnnotation);
      decl.docblock = findLeadingDocBlock(source, nodeStart, comments)!;
      const refs = collectTypeRefsFromNodes(retAnnotation, node.typeParameters);
      if (refs) decl.referencedTypes = refs;
      return decl;
    }

    case 'VariableDeclaration': {
      const results: Declaration[] = [];
      for (const declarator of node.declarations ?? []) {
        const name = declarator.id?.name ?? sliceBySpan(source, declarator.id);
        const annotation =
          declarator.id?.typeAnnotation?.typeAnnotation ?? declarator.id?.typeAnnotation;
        const decl: Declaration = {
          kind: 'variable',
          name,
          exported: false,
          raw: sliceBySpan(source, node),
        };
        if (annotation) {
          decl.value = sliceBySpan(source, annotation);
          const varRefs = collectTypeReferences(annotation);
          if (varRefs.length) decl.referencedTypes = varRefs;
        }
        decl.docblock = findLeadingDocBlock(source, nodeStart, comments)!;
        results.push(decl);
      }
      return results.length === 1 ? results[0]! : results;
    }

    case 'TSModuleDeclaration': {
      const isGlobal =
        node.global === true ||
        node.kind === 'global' ||
        (node.id?.name === 'global' && node.declare === true);
      const isStringModule =
        node.id?.type === 'Literal' ||
        node.id?.type === 'StringLiteral' ||
        typeof node.id?.value === 'string';
      const isModuleAugmentation = !isGlobal && isStringModule && node.declare === true;

      let kind: DeclarationKind;
      if (isGlobal) kind = 'global';
      else if (isModuleAugmentation) kind = 'module-augmentation';
      else kind = node.kind === 'module' ? 'module' : 'namespace';

      const decl: Declaration = {
        kind,
        name: isGlobal ? 'global' : (node.id?.name ?? node.id?.value ?? ''),
        exported: false,
        raw: sliceBySpan(source, node),
      };

      if (isGlobal || isModuleAugmentation) {
        decl.ambient = true;
        decl.exported = true;
      }

      let innerBody = node.body;
      while (innerBody?.type === 'TSModuleDeclaration') {
        decl.name += '.' + (innerBody.id?.name ?? innerBody.id?.value ?? '');
        innerBody = innerBody.body;
      }

      decl.declarations = extractDeclarations(innerBody?.body ?? [], source, comments);
      decl.docblock = findLeadingDocBlock(source, nodeStart, comments)!;
      return decl;
    }

    default:
      return null;
  }
}
