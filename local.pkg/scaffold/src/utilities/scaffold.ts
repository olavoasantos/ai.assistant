import {resolve, join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {SCAFFOLD_TYPES, PLACEHOLDERS} from '../constants.ts';
import {readMonorepoMeta} from './readMonorepoMeta.ts';
import {copyTemplate} from './copyTemplate.ts';

/**
 * Scaffolds a new workspace package, app, or example from a template.
 *
 * @param type - The scaffold type (`'package'`, `'app'`, or `'example'`).
 * @param name - The name for the new workspace entry (e.g. `'my-lib'`).
 * @param description - A short description.
 * @param rootDir - The monorepo root directory. Defaults to `process.cwd()`.
 * @returns The absolute path to the created directory.
 */
export function scaffold(
  type: keyof typeof SCAFFOLD_TYPES,
  name: string,
  description: string,
  rootDir?: string,
): string {
  const root = resolve(rootDir ?? process.cwd());
  const targetParent = SCAFFOLD_TYPES[type];
  const targetDir = join(root, targetParent, name);

  const thisFile = fileURLToPath(import.meta.url);
  const templateDir = join(dirname(thisFile), '..', 'templates', type);

  const meta = readMonorepoMeta(root);

  const replacements = new Map<string, string>([
    [PLACEHOLDERS.PACKAGE_NAME, name],
    [PLACEHOLDERS.PACKAGE_DESCRIPTION, description],
    [PLACEHOLDERS.NAME, meta.name],
    [PLACEHOLDERS.ORG, meta.org],
  ]);

  copyTemplate(templateDir, targetDir, replacements);

  return targetDir;
}
