import type {MemberInfo} from '../types.ts';

/**
 * Renders a single member's type signature as a one-line string.
 *
 * Produces declaration-style output suitable for inline code or
 * code blocks — no implementation bodies, no docblocks.
 *
 * @param m - The member to render.
 * @returns A signature string.
 */
export function renderMemberSignature(m: MemberInfo): string {
  const staticPrefix = m.static ? 'static ' : '';
  const readonlyPrefix = m.readonly ? 'readonly ' : '';
  const optional = m.optional ? '?' : '';

  switch (m.kind) {
    case 'property': {
      const type = m.type ? `: ${m.type}` : '';
      return `${staticPrefix}${readonlyPrefix}${m.name}${optional}${type};`;
    }
    case 'method':
    case 'constructor': {
      const tp = renderMemberTypeParams(m);
      const params = renderMemberParams(m.parameters ?? []);
      const ret = m.returnType ? `: ${m.returnType}` : '';
      return `${staticPrefix}${m.name}${tp}(${params})${ret};`;
    }
    case 'getter': {
      const ret = m.returnType ? `: ${m.returnType}` : '';
      return `get ${m.name}()${ret};`;
    }
    case 'setter': {
      const params = renderMemberParams(m.parameters ?? []);
      return `set ${m.name}(${params});`;
    }
    case 'index-signature': {
      const type = m.type ?? 'unknown';
      return `${readonlyPrefix}[index: string]: ${type};`;
    }
    case 'call-signature': {
      const params = renderMemberParams(m.parameters ?? []);
      const ret = m.returnType ? `: ${m.returnType}` : '';
      return `(${params})${ret};`;
    }
    default: {
      const type = m.type ? `: ${m.type}` : '';
      return `${m.name}${optional}${type};`;
    }
  }
}

function renderMemberTypeParams(m: MemberInfo): string {
  if (!m.typeParameters?.length) return '';
  return `<${m.typeParameters
    .map((t) => {
      const c = t.constraint ? ` extends ${t.constraint}` : '';
      const d = t.default ? ` = ${t.default}` : '';
      return `${t.name}${c}${d}`;
    })
    .join(', ')}>`;
}

function renderMemberParams(
  parameters: {name: string; type?: string; optional?: boolean; rest?: boolean}[],
): string {
  return parameters
    .map((p) => {
      const rest = p.rest ? '...' : '';
      const opt = p.optional ? '?' : '';
      const type = p.type ? `: ${p.type}` : '';
      return `${rest}${p.name}${opt}${type}`;
    })
    .join(', ');
}
