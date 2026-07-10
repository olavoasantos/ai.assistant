/** Pattern for matching internal identifiers in the format `prefix:id`. */
export const ID_PATTERN = /^([^:]+):(.+)$/;

/** Pattern for matching global identifiers in the format `prefix://owner/resource/id`. */
export const GID_PATTERN = /^([^:/]+):\/\/([^/]+)\/([^/]+)\/([^/]+)$/;

/** Cache of compiled regular expressions for glob patterns. */
export const GLOB_TO_REGEX_CACHE: Map<string, RegExp> = new Map();

/** Regular expression special characters that must be escaped in literal glob segments. */
export const GLOB_TO_REGEX_SPECIAL_CHARACTERS: ReadonlyArray<string> = [
  '\\',
  '^',
  '$',
  '.',
  '|',
  '?',
  '+',
  '(',
  ')',
  '[',
  ']',
  '{',
  '}',
];
