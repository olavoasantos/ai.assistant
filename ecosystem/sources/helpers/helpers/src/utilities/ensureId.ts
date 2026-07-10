import {ID_PATTERN} from '../constants';

/**
 * The result of parsing an internal identifier into its constituent parts.
 */
export interface ParsedId {
  prefix: string;
  id: string;
}

/**
 * Parses an internal identifier in the format `prefix:id` and returns its parts.
 *
 * Throws a `TypeError` if the value does not match the expected format.
 *
 * @param value - The identifier string to parse.
 * @returns The parsed prefix and id.
 *
 * @example
 * ```ts
 * ensureId('ai.assistant:a8b3c9d2');
 * // → { prefix: 'ai.assistant', id: 'a8b3c9d2' }
 * ```
 */
export function ensureId(value: string): ParsedId {
  const match = ID_PATTERN.exec(value);

  if (!match) {
    throw new TypeError(`Invalid ID format: ${value}`);
  }

  const [, prefix, id] = match;

  return {prefix, id};
}
