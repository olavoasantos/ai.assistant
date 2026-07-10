import type {ImportReference} from '../types.ts';
import {isRelativeImport} from './isRelativeImport.ts';
import {resolveRelativeSource} from './resolveRelativeSource.ts';

/**
 * Extracts import declarations from a file's AST body.
 *
 * @param body - Array of AST statement nodes.
 * @param filePath - Absolute path of the file being parsed.
 * @param sourceDir - Root source directory for relative path resolution.
 * @returns Array of extracted import references.
 */
export function extractImports(
  body: any[],
  filePath: string,
  sourceDir: string,
): ImportReference[] {
  const imports: ImportReference[] = [];

  for (const node of body) {
    if (node.type !== 'ImportDeclaration') continue;

    const rawSource = node.source?.value ?? '';
    const resolvedSource = isRelativeImport(rawSource)
      ? resolveRelativeSource(rawSource, filePath, sourceDir)
      : rawSource;
    const isTypeOnly = node.importKind === 'type';

    for (const spec of node.specifiers ?? []) {
      switch (spec.type) {
        case 'ImportSpecifier': {
          const localName = spec.local?.name ?? '';
          const importedName = spec.imported?.name ?? spec.imported?.value ?? localName;
          imports.push({
            name: localName,
            originalName: importedName,
            source: resolvedSource,
            typeOnly: isTypeOnly || spec.importKind === 'type',
          });
          break;
        }
        case 'ImportDefaultSpecifier': {
          imports.push({
            name: spec.local?.name ?? '',
            originalName: 'default',
            source: resolvedSource,
            typeOnly: isTypeOnly,
          });
          break;
        }
        case 'ImportNamespaceSpecifier': {
          imports.push({
            name: spec.local?.name ?? '',
            originalName: '*',
            source: resolvedSource,
            typeOnly: isTypeOnly,
          });
          break;
        }
      }
    }
  }

  return imports;
}
