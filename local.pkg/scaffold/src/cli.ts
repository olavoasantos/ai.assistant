#!/usr/bin/env node --experimental-strip-types --experimental-transform-types --no-warnings
import {SCAFFOLD_TYPES} from './constants.ts';
import {scaffold} from './utilities/scaffold.ts';

const args = process.argv.slice(2);
const validTypes = Object.keys(SCAFFOLD_TYPES).join(', ');

if (args.includes('--help') || args.includes('-h') || args.length === 0) {
  console.log(`
  scaffold — Create a new package, app, or example in the monorepo.

  Usage:
    scaffold <type> <name> [--description <text>]

  Types:
    package    → packages/<name>/
    app        → apps/<name>/
    example    → examples/<name>/
    local      → local.pkg/<name>/

  Options:
    --description <text>   Short description (default: "")
    --help                 Show this help message

  Examples:
    scaffold package ui
    scaffold app docs-site --description "Documentation website"
    scaffold example basic-usage
`);
  process.exit(0);
}

const type = args[0] as keyof typeof SCAFFOLD_TYPES;
const name = args[1];
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

try {
  const targetDir = scaffold(type, name, description);
  console.log(`Created ${type} at ${targetDir}`);
  console.log(`\nNext steps:`);
  console.log(`  pnpm install`);
  if (type === 'package') {
    console.log(`  cd packages/${name}`);
  } else if (type === 'app') {
    console.log(`  cd apps/${name}`);
  } else if (type === 'local') {
    console.log(`  cd local.pkg/${name}`);
  } else {
    console.log(`  cd examples/${name}`);
  }
} catch (err: any) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
