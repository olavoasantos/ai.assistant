import {resolve} from 'node:path';
import type {EntryPoint, ExtractionResult, FileEntry, MarkdownPage} from '../types.ts';
import {renderApiForEntryPoint} from './renderApiForEntryPoint.ts';
import {toAnchor} from './resolveDocLinks.ts';
import {toImportSpecifier} from './toImportSpecifier.ts';
import {toDocFileName} from './toDocFileName.ts';

/**
 * Builds markdown pages from an extraction result, one page per entry point.
 *
 * Link resolution is handled per-declaration in `renderApiForEntryPoint`
 * so that unqualified member references resolve correctly within each
 * declaration's context.
 *
 * @param packageName - The package name for import specifiers.
 * @param sourceDir - The source directory.
 * @param entryPoints - Array of entry point records.
 * @param result - The full extraction result.
 * @returns Array of markdown pages ready to write.
 */
export function buildMarkdownPages(
  packageName: string,
  sourceDir: string,
  entryPoints: EntryPoint[],
  result: ExtractionResult,
): MarkdownPage[] {
  const fileEntriesByAbsPath = new Map<string, FileEntry>();
  for (const file of result.files) {
    fileEntriesByAbsPath.set(resolve(sourceDir, file.filePath), file);
  }

  const pages: MarkdownPage[] = [];

  for (const ep of entryPoints) {
    const importSpecifier = toImportSpecifier(packageName, ep.subpath);
    const fileName = toDocFileName(ep.subpath);
    const bodyParts: string[] = [];

    bodyParts.push('```ts');
    if (ep.exportedNames.length === 1) {
      bodyParts.push(`import {${ep.exportedNames[0]}} from '${importSpecifier}';`);
    } else {
      bodyParts.push(`import {...} from '${importSpecifier}';`);
    }
    bodyParts.push('```');

    if (ep.exportedNames.length > 0) {
      bodyParts.push('');
      bodyParts.push('## Exports');
      bodyParts.push('');
      for (const name of ep.exportedNames) {
        bodyParts.push(`- [\`${name}\`](#${toAnchor(name)})`);
      }
    }

    const {markdown: apiSections} = renderApiForEntryPoint(
      ep,
      sourceDir,
      packageName,
      fileEntriesByAbsPath,
    );

    if (apiSections) {
      bodyParts.push('');
      bodyParts.push('## API');
      bodyParts.push(apiSections);
    }

    pages.push({
      fileName,
      title: `\`${importSpecifier}\``,
      body: bodyParts.join('\n').trim(),
    });
  }

  return pages;
}
