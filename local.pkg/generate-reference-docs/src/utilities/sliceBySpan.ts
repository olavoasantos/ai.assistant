/**
 * Extracts a substring from source using a span with start/end offsets.
 *
 * @param source - The full source text.
 * @param node - An AST node with `start`/`end` or `range` properties.
 * @returns The extracted substring, or empty string if the span is invalid.
 */
export function sliceBySpan(source: string, node: any): string {
  if (node == null) return '';
  const start = node.start ?? node.range?.[0];
  const end = node.end ?? node.range?.[1];
  if (start == null || end == null) return '';
  return source.slice(start, end);
}
