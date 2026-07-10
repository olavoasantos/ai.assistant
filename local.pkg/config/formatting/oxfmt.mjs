export default {
  $schema: './node_modules/oxfmt/configuration_schema.json',
  semi: true,
  trailingComma: 'all',
  singleQuote: true,
  printWidth: 100,
  tabWidth: 2,
  bracketSpacing: false,
  ignorePatterns: ['dist/**', 'coverage/**', 'pnpm-lock.yaml', '*.tsbuildinfo'],
};
