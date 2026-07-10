import {CLASS_MEMBER_TYPES} from '../constants.ts';

/**
 * Resolves the accessibility of a class member.
 *
 * - JS private fields (`#name`) → `"#private"`
 * - TS `private` keyword → `"private"`
 * - TS `protected` keyword → `"protected"`
 * - Everything else → `"public"`
 *
 * Returns undefined for non-class members (interface/enum members).
 *
 * @param member - The class member AST node.
 * @returns The accessibility string, or undefined for non-class members.
 */
export function resolveAccessibility(member: any): string | undefined {
  if (!CLASS_MEMBER_TYPES.has(member.type)) return undefined;
  if (member.key?.type === 'PrivateIdentifier' || (member.key?.name ?? '').startsWith('#')) {
    return '#private';
  }
  return member.accessibility ?? 'public';
}
