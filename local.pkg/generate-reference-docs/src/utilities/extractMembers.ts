import type {MemberInfo, ParsedComment} from '../types.ts';
import {extractMember} from './extractMember.ts';

/**
 * Extracts all members from an interface, class, or enum body.
 *
 * @param body - Array of member AST nodes.
 * @param source - The full source text.
 * @param comments - All parsed comments from the file.
 * @returns Array of extracted member info.
 */
export function extractMembers(
  body: any[],
  source: string,
  comments: ParsedComment[],
): MemberInfo[] {
  const members: MemberInfo[] = [];
  for (const member of body) {
    const info = extractMember(member, source, comments);
    if (info) members.push(info);
  }
  return members;
}
