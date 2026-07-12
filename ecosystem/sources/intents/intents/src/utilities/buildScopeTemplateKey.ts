/** Build the lookup key for a scope and kernel execution template. */
export function buildScopeTemplateKey(scope: string, kernel: string): string {
  return `${scope}:${kernel}`;
}
