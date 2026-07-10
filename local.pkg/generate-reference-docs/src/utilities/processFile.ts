import {readFileSync} from 'node:fs';
import {relative} from 'node:path';
import {parseSync} from 'oxc-parser';
import type {FileEntry, ParsedComment} from '../types.ts';
import {extractDeclarations} from './extractDeclarations.ts';
import {extractImports} from './extractImports.ts';

/**
 * Parses a single TypeScript file and extracts all declarations and imports.
 *
 * @param filePath - Absolute path to the file.
 * @param sourceDir - Root source directory for relative path resolution.
 * @returns The extracted file entry with declarations, imports, and any parse errors.
 */
export function processFile(filePath: string, sourceDir: string): FileEntry {
  const source = readFileSync(filePath, 'utf-8');
  const relativePath = relative(sourceDir, filePath);

  const entry: FileEntry = {
    filePath: relativePath,
    imports: [],
    declarations: [],
    errors: [],
  };

  try {
    const result = parseSync(filePath, source, {astType: 'ts'});

    if (result.errors?.length) {
      entry.errors = result.errors.map((e: any) =>
        typeof e === 'string' ? e : (e.message ?? JSON.stringify(e)),
      );
    }

    const comments: ParsedComment[] = (result.comments ?? []).map((c: any) => ({
      type: c.type,
      value: c.value,
      start: c.start ?? c.range?.[0],
      end: c.end ?? c.range?.[1],
    }));

    const body = result.program?.body ?? [];
    entry.imports = extractImports(body, filePath, sourceDir);

    const exportedNames = new Set<string>();
    entry.declarations = extractDeclarations(body, source, comments, exportedNames);

    for (const decl of entry.declarations) {
      if (!decl.exported && exportedNames.has(decl.name)) {
        decl.exported = true;
      }
    }
  } catch (err: any) {
    entry.errors.push(err.message ?? String(err));
  }

  return entry;
}
