#!/usr/bin/env node --experimental-strip-types --experimental-transform-types --no-warnings
import {SCAFFOLD_TYPES} from './constants.ts';
import {scaffold} from './utilities/scaffold.ts';

const args = process.argv.slice(2);
const validTypes = Object.keys(SCAFFOLD_TYPES).join(', ');

if (args.includes('--help') || args.includes('-h') || args.length === 0) {
  console.log(`
  scaffold — Create a new client, implementation, or local package in the monorepo.

  Usage:
    scaffold <type> <name> [entity] [--description <text>]

  Types:
    client                 → clients/<name>/
    implementation         → ecosystem/sources/<entity>/<name>/
    local                  → internal/<name>/

  Options:
    --description <text>   Short description (default: "")
    --help                 Show this help message

  Examples:
    scaffold implementation error error
    scaffold client docs-site --description "Documentation website"
    scaffold local docs-generator
`);
  process.exit(0);
}

const type = args[0] as keyof typeof SCAFFOLD_TYPES;
const name = args[1];
const entity = args[2];
const descIndex = args.indexOf('--description');
const description = descIndex > -1 ? (args[descIndex + 1] ?? '') : '';

if (!type || !(type in SCAFFOLD_TYPES)) {
  console.error(`Error: Invalid type "${type}". Must be one of: ${validTypes}`);
  process.exit(1);
}

if (!name) {
  console.error('Error: Name is required.');
  process.exit(1);
}

if (type === 'implementation' && !entity) {
  console.error('Error: Entity is required for implementation type.');
  process.exit(1);
}

try {
  const targetDir = scaffold({type, name, description, entity});
  console.log(`Created ${type} at ${targetDir}`);
  console.log(`\nNext steps:`);
  console.log(`  pnpm install`);
  console.log(`  cd ${targetDir}`);
} catch (err: any) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
