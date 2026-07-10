import {existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync} from 'node:fs';
import {join, relative, resolve} from 'node:path';
import type {ExtractionResult, GenerateOptions} from '../types.ts';
import {findTsFiles} from './findTsFiles.ts';
import {processFile} from './processFile.ts';
import {readPackageEntryPoints} from './readPackageEntryPoints.ts';
import {tracePublicApi} from './tracePublicApi.ts';
import {buildEntryPointRecords} from './buildEntryPointRecords.ts';
import {buildMarkdownPages} from './buildMarkdownPages.ts';
import {filterExported} from './filterExported.ts';
import {countDeclarations} from './countDeclarations.ts';

/**
 * Generates reference documentation for a package.
 *
 * Reads the package's `package.json` to discover entry points, traces the public
 * API through re-exports, extracts declarations and docblocks using `oxc-parser`,
 * and generates markdown reference pages and an optional JSON index.
 *
 * @param options - Configuration options.
 * @returns The full extraction result.
 */
export function generateReferenceDocs(options: GenerateOptions = {}): ExtractionResult {
  const packageDir = resolve(options.packageDir ?? process.cwd());
  const sourceDir = resolve(options.sourceDir ?? join(packageDir, 'src'));
  const outDir = resolve(options.outDir ?? join(packageDir, 'docs', 'references'));
  const writeJson = options.json ?? true;
  const writeMarkdown = options.markdown ?? true;

  const pkgPath = join(packageDir, 'package.json');
  if (!existsSync(pkgPath)) {
    throw new Error(`No package.json found in ${packageDir}`);
  }
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const packageName: string = pkg.name ?? 'unknown';

  const entryPoints = readPackageEntryPoints(packageDir);
  const publicApiFiles = tracePublicApi(entryPoints, packageDir);
  const entryPointRecords = buildEntryPointRecords(entryPoints, packageDir, sourceDir);

  const allFiles = findTsFiles(sourceDir);
  const filesToProcess = [...publicApiFiles.keys()];

  const fileEntries = [];
  let totalDeclarations = 0;

  for (const filePath of filesToProcess) {
    const entry = processFile(filePath, sourceDir);

    const publicNames = publicApiFiles.get(filePath);
    if (publicNames && !publicNames.has('*')) {
      entry.declarations = entry.declarations.filter(
        (d) => publicNames.has(d.name) || d.ambient === true,
      );
    }
    entry.declarations = filterExported(entry.declarations);

    if (entry.declarations.length > 0 || entry.errors.length > 0) {
      totalDeclarations += countDeclarations(entry.declarations);
      fileEntries.push(entry);
    }
  }

  for (const filePath of allFiles) {
    if (publicApiFiles.has(filePath)) continue;
    const entry = processFile(filePath, sourceDir);
    entry.declarations = entry.declarations.filter((d) => d.ambient === true);
    if (entry.declarations.length > 0) {
      totalDeclarations += countDeclarations(entry.declarations);
      fileEntries.push(entry);
    }
  }

  const result: ExtractionResult = {
    generatedAt: new Date().toISOString(),
    packageName,
    sourceDir: relative(process.cwd(), sourceDir) || '.',
    fileCount: fileEntries.length,
    declarationCount: totalDeclarations,
    entryPoints: entryPointRecords,
    files: fileEntries,
  };

  if (writeMarkdown || writeJson) {
    if (!existsSync(outDir)) mkdirSync(outDir, {recursive: true});
  }

  if (writeMarkdown) {
    if (existsSync(outDir)) {
      for (const fileName of readdirSync(outDir)) {
        if (fileName.endsWith('.md')) unlinkSync(join(outDir, fileName));
      }
    }

    const pages = buildMarkdownPages(packageName, sourceDir, entryPointRecords, result);
    for (const page of pages) {
      const content = `# ${page.title}\n\n${page.body.trim()}\n`;
      writeFileSync(join(outDir, page.fileName), content, 'utf-8');
    }
  }

  if (writeJson) {
    writeFileSync(join(outDir, 'references.json'), JSON.stringify(result, null, 2), 'utf-8');
  }

  return result;
}
