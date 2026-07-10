import type {DocTag} from '../types.ts';
import {NAMED_TAGS} from '../constants.ts';

/**
 * Converts a raw tag accumulator into a finalized DocTag.
 *
 * Parses named tags (e.g. `@param name - description`) to extract the
 * name and description separately.
 *
 * @param tag - The raw tag with tag name and accumulated lines.
 * @returns A finalized DocTag.
 */
export function finalizeTag(tag: {tag: string; lines: string[]}): DocTag {
  const combined = tag.lines.join('\n').trim();

  let name: string = tag.tag;
  let description: string = combined;

  if (NAMED_TAGS.has(tag.tag)) {
    const withType = combined.match(/^\{[^}]*\}\s+(\S+)\s*[-–—]?\s*([\s\S]*)/);
    const withoutType = combined.match(/^(\S+)\s*[-–—]?\s*([\s\S]*)/);
    if (withType) {
      name = withType[1] || name;
      description = withType[2]?.trim() || description;
    } else if (withoutType) {
      name = withoutType[1] || name;
      description = withoutType[2]?.trim() || description;
    }
  }

  return {tag: tag.tag, name, description, raw: `@${tag.tag} ${combined}`};
}
