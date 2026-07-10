import type {DocBlock, ParsedComment} from '../types.ts';
import {parseDocBlock} from './parseDocBlock.ts';

/**
 * Finds the JSDoc block comment immediately preceding a node's start position.
 *
 * @param source - The full source text.
 * @param nodeStart - The start offset of the target node.
 * @param comments - All parsed comments from the file.
 * @returns The parsed DocBlock, or undefined if no leading docblock found.
 */
export function findLeadingDocBlock(
  source: string,
  nodeStart: number,
  comments: ParsedComment[],
): DocBlock | undefined {
  let best: ParsedComment | undefined;

  for (const c of comments) {
    if (c.type !== 'Block') continue;
    if (!c.value.startsWith('*')) continue;
    if (c.end > nodeStart) continue;

    const gap = source.slice(c.end, nodeStart);
    if (/^[\s]*$/.test(gap) || /^[\s]*(export\s+(default\s+)?|declare\s+)*[\s]*$/.test(gap)) {
      if (!best || c.end > best.end) best = c;
    }
  }

  if (!best) return undefined;
  return parseDocBlock(source.slice(best.start, best.end));
}
