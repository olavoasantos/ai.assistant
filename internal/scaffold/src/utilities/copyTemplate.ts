import {existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

/**
 * Copies a template directory to the target, replacing placeholder tokens
 * in file contents and stripping `.tmpl` extensions from filenames.
 *
 * @param templateDir - Absolute path to the template directory.
 * @param targetDir - Absolute path to the output directory.
 * @param replacements - Map of placeholder token → replacement value.
 */
export function copyTemplate(
  templateDir: string,
  targetDir: string,
  replacements: Map<string, string>,
): void {
  if (existsSync(targetDir)) {
    throw new Error(`Target directory already exists: ${targetDir}`);
  }

  walkAndCopy(templateDir, targetDir, replacements);
}

function walkAndCopy(srcDir: string, destDir: string, replacements: Map<string, string>): void {
  mkdirSync(destDir, {recursive: true});

  for (const entry of readdirSync(srcDir, {withFileTypes: true})) {
    const srcPath = join(srcDir, entry.name);
    const destName = entry.name.replace(/\.tmpl$/, '');
    const destPath = join(destDir, destName);

    if (entry.isDirectory()) {
      walkAndCopy(srcPath, destPath, replacements);
    } else {
      let content = readFileSync(srcPath, 'utf-8');
      for (const [token, value] of replacements) {
        content = content.replaceAll(token, value);
      }
      writeFileSync(destPath, content, 'utf-8');
    }
  }
}
