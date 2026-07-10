import {readFileSync} from 'node:fs';
import {parseSync} from 'oxc-parser';
import type {ReExport} from '../types.ts';
import {resolveSource} from './resolveSource.ts';
import {extractDeclaredNames} from './extractDeclaredNames.ts';

/**
 * Parses a file and extracts locally declared exports and re-exports.
 *
 * @param filePath - Absolute path to the file.
 * @returns Object with `localExports` (Set of names) and `reExports` (array of ReExport).
 */
export function analyzeFileExports(filePath: string): {
  localExports: Set<string>;
  reExports: ReExport[];
} {
  const localExports = new Set<string>();
  const reExports: ReExport[] = [];

  const source = readFileSync(filePath, 'utf-8');
  const result = parseSync(filePath, source, {astType: 'ts'});
  const body = result.program?.body ?? [];

  for (const node of body) {
    switch (node.type) {
      case 'ExportNamedDeclaration': {
        if (node.source) {
          const resolvedFile = resolveSource(node.source.value ?? '', filePath);
          const names: string[] = [];
          const renames = new Map<string, string>();

          for (const spec of node.specifiers ?? []) {
            const localName = 'name' in spec.local ? spec.local.name : spec.local.value;
            const exportedName = spec.exported
              ? 'name' in spec.exported
                ? spec.exported.name
                : spec.exported.value
              : localName;
            names.push(exportedName);
            if (localName !== exportedName) renames.set(localName, exportedName);
          }

          reExports.push({names, star: false, source: resolvedFile, renames});
        } else if (node.declaration) {
          extractDeclaredNames(node.declaration, localExports);
        } else if (node.specifiers) {
          for (const spec of node.specifiers) {
            const name = spec.exported
              ? 'name' in spec.exported
                ? spec.exported.name
                : spec.exported.value
              : 'name' in spec.local
                ? spec.local.name
                : spec.local.value;
            if (name) localExports.add(name);
          }
        }
        break;
      }

      case 'ExportDefaultDeclaration': {
        localExports.add('default');
        break;
      }

      case 'ExportAllDeclaration': {
        const resolvedFile = resolveSource(node.source?.value ?? '', filePath);

        if (node.exported) {
          localExports.add('name' in node.exported ? node.exported.name : node.exported.value);
        } else {
          reExports.push({names: [], star: true, source: resolvedFile, renames: new Map()});
        }
        break;
      }
    }
  }

  return {localExports, reExports};
}
