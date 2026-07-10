/**
 * Extracts declared names from a declaration AST node.
 *
 * @param node - The declaration AST node.
 * @param names - Mutable set to add discovered names to.
 */
export function extractDeclaredNames(node: any, names: Set<string>): void {
  if (!node) return;
  switch (node.type) {
    case 'VariableDeclaration':
      for (const decl of node.declarations ?? []) {
        if (decl.id?.name) names.add(decl.id.name);
      }
      break;
    case 'FunctionDeclaration':
    case 'ClassDeclaration':
    case 'TSDeclareFunction':
    case 'TSTypeAliasDeclaration':
    case 'TSInterfaceDeclaration':
    case 'TSEnumDeclaration':
    case 'TSModuleDeclaration':
      if (node.id?.name) names.add(node.id.name);
      break;
  }
}
