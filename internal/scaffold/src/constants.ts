/** Valid scaffold types and their target directories. */
export const SCAFFOLD_TYPES = {
  client: 'clients',
  implementation: 'ecosystem/sources',
  local: 'internal',
} as const;

/** Placeholder tokens used in template files. */
export const PLACEHOLDERS = {
  PACKAGE_NAME: '{{PACKAGE_NAME}}',
  PACKAGE_DESCRIPTION: '{{PACKAGE_DESCRIPTION}}',
  NAME: '{{NAME}}',
  ORG: '{{ORG}}',
  ENTITY: '{{ENTITY}}',
} as const;
