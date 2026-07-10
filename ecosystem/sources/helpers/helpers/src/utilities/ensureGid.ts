import {GID_PATTERN} from '../constants';

/**
 * The result of parsing a global identifier into its constituent parts.
 */
export interface ParsedGid {
  prefix: string;
  owner: string;
  resource: string;
  id: string;
}

/**
 * Parses a global identifier in the format `prefix://owner/resource/id` and returns its parts.
 *
 * Throws a `TypeError` if the value does not match the expected GID format. Slashes are not
 * permitted in any segment — GIDs are parseable via `new URL(gid)` per the platform charter.
 *
 * @param value - The GID string to parse.
 * @returns The parsed prefix, owner, resource, and id.
 *
 * @example
 * ```ts
 * ensureGid('gid://ai.assistant/Session/abc123');
 * // → { prefix: 'gid', owner: 'ai.assistant', resource: 'Session', id: 'abc123' }
 * ```
 */
export function ensureGid(value: string): ParsedGid {
  const match = GID_PATTERN.exec(value);

  if (!match) {
    throw new TypeError(`Invalid GID format: ${value}`);
  }

  const [, prefix, owner, resource, id] = match;

  return {prefix, owner, resource, id};
}
