#!/usr/bin/env node --experimental-strip-types --experimental-transform-types --no-warnings
import {resolve} from 'node:path';
import {generateReferenceDocs} from './utilities/generateReferenceDocs.ts';

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
  generate-reference-docs — Generate API reference docs from TypeScript source.

  Usage:
    generate-reference-docs [options]

  Options:
    --package-dir <dir>   Package directory (default: cwd)
    --source-dir <dir>    Source directory (default: src/)
    --out-dir <dir>       Output directory (default: docs/references/)
    --no-json             Skip JSON output
    --no-markdown         Skip markdown output
    --help                Show this help message

  The tool reads package.json to discover entry points, traces the public
  API through re-exports, extracts declarations and docblocks, and generates
  markdown reference pages plus a references.json index.
`);
  process.exit(0);
}

function getArg(name: string): string | undefined {
  const index = args.indexOf(name);
  return index > -1 ? args[index + 1] : undefined;
}

const packageDir = getArg('--package-dir');
const sourceDir = getArg('--source-dir');
const outDir = getArg('--out-dir');
const noJson = args.includes('--no-json');
const noMarkdown = args.includes('--no-markdown');

try {
  const result = generateReferenceDocs({
    packageDir: packageDir ? resolve(packageDir) : undefined,
    sourceDir: sourceDir ? resolve(sourceDir) : undefined,
    outDir: outDir ? resolve(outDir) : undefined,
    json: !noJson,
    markdown: !noMarkdown,
  });

  const outPath = outDir ?? 'docs/references';
  console.log(
    `Generated reference docs for ${result.packageName}: ${result.declarationCount} declarations from ${result.fileCount} files → ${outPath}/`,
  );
} catch (err: any) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
