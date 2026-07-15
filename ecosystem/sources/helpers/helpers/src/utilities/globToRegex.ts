import {GLOB_TO_REGEX_CACHE, GLOB_TO_REGEX_SPECIAL_CHARACTERS} from '../constants';

/**
 * Compiles a glob pattern into an anchored regular expression.
 *
 * The `*` wildcard matches any substring. All other regular-expression special
 * characters are escaped so they are treated literally.
 *
 * @param glob - The glob pattern to compile.
 * @returns A cached regular expression for the glob pattern.
 *
 * @example
 * ```ts
 * globToRegex('tool:*').test('tool:started'); // true
 * globToRegex('tool:*').test('turn:started'); // false
 * ```
 */
export function globToRegex(glob: string): RegExp {
  if (GLOB_TO_REGEX_CACHE.has(glob)) {
    return GLOB_TO_REGEX_CACHE.get(glob)!;
  }

  let pattern = '';
  for (let index = 0; index < glob.length; index += 1) {
    const character = glob[index];

    if (character === '*') {
      pattern += '.*?';
      continue;
    }

    if (GLOB_TO_REGEX_SPECIAL_CHARACTERS.includes(character)) {
      pattern += `\\${character}`;
      continue;
    }

    pattern += character;
  }

  const regex = new RegExp(`^${pattern}$`);
  GLOB_TO_REGEX_CACHE.set(glob, regex);
  return regex;
}
