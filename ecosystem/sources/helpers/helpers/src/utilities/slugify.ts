/**
 * Slugifies a string: lowercase, hyphenated, ASCII-only.
 *
 * Normalizes diacritics (e.g. `é` → `e`), replaces spaces with hyphens,
 * and strips any character that is not a lowercase letter, digit, or hyphen.
 *
 * @param value - The string to slugify.
 * @returns The slugified string.
 *
 * @example
 * ```ts
 * slugify('Hello World'); // → 'hello-world'
 * slugify('Café Résumé'); // → 'cafe-resume'
 * ```
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/ /g, '-')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '');
}
