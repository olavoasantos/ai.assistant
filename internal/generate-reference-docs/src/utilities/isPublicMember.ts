import type {MemberInfo} from '../types.ts';

/**
 * Checks whether a member should appear in the public API reference.
 *
 * Excludes members that are private, JS-private (`#name`), protected,
 * or marked with `@internal` in their docblock.
 *
 * @param member - The member to check.
 * @returns `true` if the member is part of the public API.
 */
export function isPublicMember(member: MemberInfo): boolean {
  if (
    member.accessibility === 'private' ||
    member.accessibility === '#private' ||
    member.accessibility === 'protected'
  ) {
    return false;
  }

  if (member.docblock) {
    const hasInternalTag = member.docblock.tags.some((t) => t.tag === 'internal');
    if (hasInternalTag) return false;

    if (member.docblock.summary.startsWith('@internal')) return false;
  }

  return true;
}
