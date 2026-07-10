/** Valid scaffold types and their target directories. */
export const SCAFFOLD_TYPES = {
  package: 'packages',
  app: 'apps',
  example: 'examples',
  local: 'local.pkg',
} as const;

/** Placeholder tokens used in template files. */
export const PLACEHOLDERS = {
  PACKAGE_NAME: '{{PACKAGE_NAME}}',
  PACKAGE_DESCRIPTION: '{{PACKAGE_DESCRIPTION}}',
  NAME: '{{NAME}}',
  ORG: '{{ORG}}',
} as const;
