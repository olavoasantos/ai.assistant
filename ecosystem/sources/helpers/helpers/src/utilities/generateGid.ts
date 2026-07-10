import {generateRandomString} from './generateRandomString';

/** Options for generating a global identifier. */
export interface GenerateGidOptions {
  /** Identifier scheme prefix. @defaultValue `'gid'` */
  prefix?: string;
  /** Owning namespace. @defaultValue `'ai.assistant'` */
  owner?: string;
  /** The resource type name (e.g. `'Session'`, `'Agent'`). */
  resource: string;
  /** An explicit id. A random 8-character string is generated when omitted. */
  id?: string | number;
}

/**
 * Generates a global identifier in `prefix://owner/resource/id` format.
 *
 * @param resourceOrOptions - A resource name string, or full options.
 * @returns The formatted global identifier string.
 *
 * @example
 * ```ts
 * generateGid('Session');
 * // → 'gid://ai.assistant/Session/a3b9c1d2'
 *
 * generateGid({prefix: 'urn', owner: 'acme', resource: 'Document', id: 'final'});
 * // → 'urn://acme/Document/final'
 * ```
 */
export function generateGid(resourceOrOptions: string | GenerateGidOptions): string {
  const {
    prefix = 'gid',
    owner = 'ai.assistant',
    resource,
    id = generateRandomString(8),
  } = typeof resourceOrOptions === 'string' ? {resource: resourceOrOptions} : resourceOrOptions;

  return `${prefix}://${owner}/${resource}/${id}`;
}
