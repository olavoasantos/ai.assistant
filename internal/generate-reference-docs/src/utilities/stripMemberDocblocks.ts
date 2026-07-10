/**
 * Strips JSDoc comments from a raw declaration string so the code block
 * only shows the clean signature without redundant inline documentation.
 *
 * @param raw - The raw declaration string.
 * @returns The declaration string with all JSDoc block comments removed.
 */
export function stripMemberDocblocks(raw: string): string {
  return raw
    .replace(/\/\*\*[\s\S]*?\*\//g, '')
    .replace(/\n(\s*\n)+/g, '\n')
    .trim();
}
