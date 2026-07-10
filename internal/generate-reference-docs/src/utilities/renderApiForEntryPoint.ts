import type {Declaration, EntryPoint, FileEntry, ImportReference} from '../types.ts';
import {resolve} from 'node:path';
import {renderDeclarationMarkdown} from './renderDeclarationMarkdown.ts';
import {buildExternalIndex, resolveDocLinks} from './resolveDocLinks.ts';
import {traceFile} from './traceFile.ts';

/**
 * Result of rendering the API section for an entry point.
 */
export interface ApiRenderResult {
  /** The rendered markdown string. Empty if no declarations found. */
  markdown: string;
  /** The declarations that were rendered. */
  declarations: Declaration[];
}

/**
 * Renders the API section for a single entry point by tracing its
 * public declarations and rendering each as markdown.
 *
 * Resolves `{@link}` references per-declaration so that unqualified
 * member names resolve correctly against the current declaration's
 * own members, even when multiple declarations share method names.
 *
 * Cross-package references (e.g. `AssistantError` imported from
 * `@olavoasantos/error`) are resolved to relative links pointing
 * at the target package's reference documentation.
 *
 * @param ep - The entry point record.
 * @param sourceDir - The source directory.
 * @param packageName - The current package's npm name.
 * @param fileEntriesByAbsPath - Map of absolute file path → FileEntry.
 * @returns The rendered markdown and the declarations used.
 */
export function renderApiForEntryPoint(
  ep: EntryPoint,
  sourceDir: string,
  packageName: string,
  fileEntriesByAbsPath: Map<string, FileEntry>,
): ApiRenderResult {
  const entryResolved = ep.resolvedPaths[0];
  const entryAbsPath = entryResolved ? resolve(sourceDir, entryResolved) : null;

  const localPublic = new Map<string, Set<string>>();
  if (entryAbsPath) {
    traceFile(entryAbsPath, '*', localPublic, new Set());
  }

  const allDeclarations: Declaration[] = [];
  const allImports: ImportReference[] = [];
  const publicFiles = [...localPublic.entries()].toSorted(([a], [b]) => a.localeCompare(b));

  // First pass: collect all declarations and imports
  for (const [absFilePath, names] of publicFiles) {
    if (!names || names.size === 0) continue;
    const entry = fileEntriesByAbsPath.get(absFilePath);
    if (!entry) continue;

    const decls = entry.declarations.filter((d) => d.exported && names.has(d.name));
    for (const d of decls) {
      allDeclarations.push(d);
    }
    for (const imp of entry.imports) {
      allImports.push(imp);
    }
  }

  const externalIndex = buildExternalIndex(allImports, packageName);

  // Second pass: render each declaration and resolve its links with full context
  const sections: string[] = [];
  for (const decl of allDeclarations) {
    const raw = renderDeclarationMarkdown(decl);
    const resolved = resolveDocLinks(raw, decl, allDeclarations, externalIndex);
    sections.push(resolved);
  }

  return {
    markdown: sections.length > 0 ? sections.join('\n').trim() : '',
    declarations: allDeclarations,
  };
}
