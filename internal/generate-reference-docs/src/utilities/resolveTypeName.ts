/**
 * Extracts the fully qualified name from a TSTypeReference typeName.
 * Handles both `Identifier` (simple) and `TSQualifiedName` (dotted).
 *
 * @param node - A typeName AST node.
 * @returns The resolved type name string.
 */
export function resolveTypeName(node: any): string {
  if (!node) return '';
  if (node.type === 'Identifier') return node.name ?? '';
  if (node.type === 'TSQualifiedName') {
    const left = resolveTypeName(node.left);
    const right = node.right?.name ?? '';
    return left ? `${left}.${right}` : right;
  }
  return '';
}
