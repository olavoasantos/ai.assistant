import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {collectExports} from './collectExports.ts';

/**
 * Reads package.json and extracts all export entry points.
 * Supports the `exports` field (string, object, conditional) and fallbacks
 * to `main`/`types`/`module`.
 *
 * @param packageDir - Directory containing the package.json.
 * @returns Map of subpath → file path.
 */
export function readPackageEntryPoints(packageDir: string): Map<string, string> {
  const pkgPath = join(packageDir, 'package.json');
  if (!existsSync(pkgPath)) {
    throw new Error(`No package.json found in ${packageDir}`);
  }

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const entries = new Map<string, string>();

  if (pkg.exports) {
    collectExports(pkg.exports, '.', entries);
  } else {
    const fallback = pkg.types ?? pkg.typings ?? pkg.module ?? pkg.main;
    if (fallback) entries.set('.', fallback);
  }

  return entries;
}
