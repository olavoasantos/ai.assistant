import {resolve, join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {SCAFFOLD_TYPES, PLACEHOLDERS} from '../constants.ts';
import {readMonorepoMeta} from './readMonorepoMeta.ts';
import {copyTemplate} from './copyTemplate.ts';

export interface ScaffoldOptions {
  type: keyof typeof SCAFFOLD_TYPES;
  name: string;
  description: string;
  entity?: string;
  rootDir?: string;
}

/**
 * Scaffolds a supported workspace entry from a template.
 *
 * @param options - The scaffold options.
 * @returns The absolute path to the created directory.
 */
export function scaffold({type, name, description, entity, rootDir}: ScaffoldOptions): string {
  const root = resolve(rootDir ?? process.cwd());
  const targetParent = SCAFFOLD_TYPES[type];
  const targetDir = entity
    ? join(root, targetParent, entity, name)
    : join(root, targetParent, name);

  const thisFile = fileURLToPath(import.meta.url);
  const templateDir = join(dirname(thisFile), '..', 'templates', type);

  const meta = readMonorepoMeta(root);

  const replacements = new Map<string, string>([
    [PLACEHOLDERS.PACKAGE_NAME, name],
    [PLACEHOLDERS.PACKAGE_DESCRIPTION, description],
    [PLACEHOLDERS.NAME, meta.name],
    [PLACEHOLDERS.ORG, meta.org],
    [PLACEHOLDERS.ENTITY, entity ?? ''],
  ]);

  copyTemplate(templateDir, targetDir, replacements);

  return targetDir;
}
