import {generateRandomString} from './generateRandomString';

/**
 * Generates an internal identifier in `prefix:id` format.
 *
 * @param prefix - The identifier prefix. @defaultValue `'ai.assistant'`
 * @returns A formatted internal identifier with a random 8-character suffix.
 *
 * @example
 * ```ts
 * generateId('test'); // → 'test:a8b3c9d2'
 * ```
 */
export function generateId(prefix: string = 'ai.assistant'): string {
  return `${prefix}:${generateRandomString(8)}`;
}
