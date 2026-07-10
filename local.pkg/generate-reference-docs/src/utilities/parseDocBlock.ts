import type {DocBlock, DocTag} from '../types.ts';
import {finalizeTag} from './finalizeTag.ts';

/**
 * Parses a JSDoc comment string into a structured DocBlock.
 *
 * @param raw - The raw JSDoc comment string including delimiters.
 * @returns A parsed DocBlock with summary, description, and tags.
 */
export function parseDocBlock(raw: string): DocBlock {
  let body = raw;
  if (body.startsWith('/**')) body = body.slice(3);
  if (body.endsWith('*/')) body = body.slice(0, -2);

  const lines = body.split('\n').map((line) => line.replace(/^\s*\*\s?/, '').trimEnd());

  const tags: DocTag[] = [];
  const descriptionLines: string[] = [];
  let currentTag: {tag: string; lines: string[]} | null = null;

  for (const line of lines) {
    const [, tagName, tagContent] = line.match(/^@(\w+)\s*(.*)/) || [];
    if (tagName && tagContent !== undefined) {
      if (currentTag) tags.push(finalizeTag(currentTag));
      currentTag = {tag: tagName, lines: [tagContent]};
    } else if (currentTag) {
      currentTag.lines.push(line);
    } else {
      descriptionLines.push(line);
    }
  }
  if (currentTag) tags.push(finalizeTag(currentTag));

  const fullDesc = descriptionLines.join('\n').trim();
  const summaryEnd = fullDesc.indexOf('\n\n');
  const summary = summaryEnd > -1 ? fullDesc.slice(0, summaryEnd) : fullDesc;

  return {summary, description: fullDesc, tags, raw};
}
