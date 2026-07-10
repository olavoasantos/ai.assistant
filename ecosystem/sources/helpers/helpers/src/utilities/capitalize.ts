/**
 * Capitalizes the first character of a string, leaving the rest unchanged.
 *
 * @param str - The string to capitalize.
 * @returns The string with its first character uppercased.
 *
 * @example
 * ```ts
 * capitalize('hello'); // → 'Hello'
 * capitalize('helloWorld'); // → 'HelloWorld'
 * ```
 */
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
