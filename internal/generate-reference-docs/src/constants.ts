/** Built-in types that should not appear in referencedTypes. */
export const BUILTIN_TYPES = new Set([
  'string',
  'number',
  'boolean',
  'void',
  'null',
  'undefined',
  'never',
  'any',
  'unknown',
  'object',
  'symbol',
  'bigint',
  'String',
  'Number',
  'Boolean',
  'Object',
  'Symbol',
  'BigInt',
  'Function',
  'Array',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'Promise',
  'Record',
  'Partial',
  'Required',
  'Readonly',
  'Pick',
  'Omit',
  'Exclude',
  'Extract',
  'NonNullable',
  'Parameters',
  'ReturnType',
  'InstanceType',
  'ConstructorParameters',
  'ThisParameterType',
  'OmitThisParameter',
  'ThisType',
  'Uppercase',
  'Lowercase',
  'Capitalize',
  'Uncapitalize',
  'Awaited',
  'NoInfer',
]);

/** File extensions treated as TypeScript source files. */
export const TS_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts']);

/** Extensions to try when resolving a relative import to a source file. */
export const RESOLVE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.d.ts',
  '/index.ts',
  '/index.tsx',
  '/index.d.ts',
];

/** Directories to skip during file discovery. */
export const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'coverage',
  'specs',
]);

/** AST node types that represent class members with accessibility modifiers. */
export const CLASS_MEMBER_TYPES = new Set([
  'PropertyDefinition',
  'TSAbstractPropertyDefinition',
  'MethodDefinition',
  'TSAbstractMethodDefinition',
]);

/** JSDoc tags that commonly have a name then description (e.g. `@param name - desc`). */
export const NAMED_TAGS = new Set([
  'param',
  'property',
  'prop',
  'typedef',
  'template',
  'typeParam',
  'typeparam',
  'fires',
  'emits',
  'listens',
  'alias',
]);
