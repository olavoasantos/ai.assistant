import type {Declaration} from '../types.ts';
import {isPublicMember} from './isPublicMember.ts';
import {renderMemberSignature} from './renderMemberSignature.ts';

/**
 * Renders a declaration's type signature as a clean code string.
 *
 * Reconstructs a signature-only form for all declaration kinds.
 * Private members, `@internal` members, and implementation bodies
 * are excluded — only the public API shape is shown.
 *
 * @param decl - The declaration to render.
 * @returns The signature string for use in a code block.
 */
export function renderSignature(decl: Declaration): string {
  if (decl.kind === 'function') {
    return renderFunctionSignature(decl);
  }

  if (decl.kind === 'type') {
    return renderTypeSignature(decl);
  }

  if (decl.kind === 'class') {
    return renderClassSignature(decl);
  }

  if (decl.kind === 'interface') {
    return renderInterfaceSignature(decl);
  }

  if (decl.kind === 'enum') {
    return renderEnumSignature(decl);
  }

  if (decl.kind === 'variable') {
    return renderVariableSignature(decl);
  }

  return `declare ${decl.kind} ${decl.name};`;
}

function renderTypeParams(decl: Declaration): string {
  if (!decl.typeParameters?.length) return '';
  return `<${decl.typeParameters
    .map((tp) => {
      const constraint = tp.constraint ? ` extends ${tp.constraint}` : '';
      const def = tp.default ? ` = ${tp.default}` : '';
      return `${tp.name}${constraint}${def}`;
    })
    .join(', ')}>`;
}

function renderFunctionSignature(decl: Declaration): string {
  const typeParams = renderTypeParams(decl);
  const params = renderParams(decl.parameters ?? []);
  const ret = decl.returnType ? `: ${decl.returnType}` : '';
  return `declare function ${decl.name}${typeParams}(${params})${ret};`;
}

function renderTypeSignature(decl: Declaration): string {
  const typeParams = renderTypeParams(decl);
  return `export type ${decl.name}${typeParams} = ${decl.value ?? 'unknown'};`;
}

function renderClassSignature(decl: Declaration): string {
  const typeParams = renderTypeParams(decl);
  const ext = decl.extends?.length ? ` extends ${decl.extends.join(', ')}` : '';
  const impl = decl.implements?.length ? ` implements ${decl.implements.join(', ')}` : '';
  const header = `class ${decl.name}${typeParams}${ext}${impl}`;

  const publicMembers = (decl.members ?? []).filter(isPublicMember);
  if (publicMembers.length === 0) return `${header} {}`;

  const lines = publicMembers.map((m) => `  ${renderMemberSignature(m)}`);
  return `${header} {\n${lines.join('\n')}\n}`;
}

function renderInterfaceSignature(decl: Declaration): string {
  const typeParams = renderTypeParams(decl);
  const ext = decl.extends?.length ? ` extends ${decl.extends.join(', ')}` : '';
  const header = `interface ${decl.name}${typeParams}${ext}`;

  const publicMembers = (decl.members ?? []).filter(isPublicMember);
  if (publicMembers.length === 0) return `${header} {}`;

  const lines = publicMembers.map((m) => `  ${renderMemberSignature(m)}`);
  return `${header} {\n${lines.join('\n')}\n}`;
}

function renderEnumSignature(decl: Declaration): string {
  const header = `enum ${decl.name}`;
  const members = decl.members ?? [];
  if (members.length === 0) return `${header} {}`;

  const lines = members.map((m) => {
    const val = m.value != null ? ` = ${m.value}` : '';
    return `  ${m.name}${val},`;
  });
  return `${header} {\n${lines.join('\n')}\n}`;
}

function renderVariableSignature(decl: Declaration): string {
  const typeStr = decl.value ? `: ${decl.value}` : '';
  return `declare const ${decl.name}${typeStr};`;
}

function renderParams(
  parameters: {name: string; type?: string; optional?: boolean; rest?: boolean}[],
): string {
  return parameters
    .map((p) => {
      const rest = p.rest ? '...' : '';
      const optional = p.optional ? '?' : '';
      const type = p.type ? `: ${p.type}` : '';
      return `${rest}${p.name}${optional}${type}`;
    })
    .join(', ');
}
