import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';

/**
 * Reads the root `package.json` and extracts the monorepo name and org
 * from the repository URL and package name.
 *
 * @param rootDir - The monorepo root directory.
 * @returns Object with `name` and `org` strings.
 */
export function readMonorepoMeta(rootDir: string): {name: string; org: string} {
  const pkgPath = join(rootDir, 'package.json');
  if (!existsSync(pkgPath)) {
    throw new Error(`No package.json found in ${rootDir}`);
  }

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  const repoUrl: string = pkg.repository?.url ?? '';
  const match = repoUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);

  return {
    org: match?.[1] ?? '',
    name: match?.[2] ?? '',
  };
}
