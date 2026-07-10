/** Supported declaration kinds extracted from source files. */
export type DeclarationKind =
  | 'type'
  | 'interface'
  | 'enum'
  | 'class'
  | 'function'
  | 'variable'
  | 'namespace'
  | 'module'
  | 'global'
  | 'module-augmentation';

/** A single `@tag` from a JSDoc block. */
export interface DocTag {
  tag: string;
  name?: string;
  description?: string;
  raw: string;
}

/** Parsed JSDoc comment. */
export interface DocBlock {
  summary: string;
  description: string;
  tags: DocTag[];
  raw: string;
}

/** A type parameter like `<T extends Foo = Bar>`. */
export interface TypeParameter {
  name: string;
  constraint?: string;
  default?: string;
}

/** A function or method parameter. */
export interface ParameterInfo {
  name: string;
  type?: string;
  optional?: boolean;
  rest?: boolean;
  default?: string;
  referencedTypes?: string[];
}

/** A member inside an interface, class, enum, or namespace. */
export interface MemberInfo {
  name: string;
  kind: string;
  type?: string;
  optional?: boolean;
  readonly?: boolean;
  static?: boolean;
  accessibility?: string;
  value?: string;
  docblock?: DocBlock;
  typeParameters?: TypeParameter[];
  parameters?: ParameterInfo[];
  returnType?: string;
  referencedTypes?: string[];
  raw: string;
}

/** An extracted declaration from a source file. */
export interface Declaration {
  kind: DeclarationKind;
  name: string;
  exported: boolean;
  /** True for `declare global` and `declare module "..."` augmentations. */
  ambient?: boolean;
  docblock?: DocBlock;
  typeParameters?: TypeParameter[];
  extends?: string[];
  implements?: string[];
  members?: MemberInfo[];
  parameters?: ParameterInfo[];
  returnType?: string;
  /** For type aliases, the RHS; for variables, the type annotation. */
  value?: string;
  /** Nested declarations for namespaces/modules. */
  declarations?: Declaration[];
  referencedTypes?: string[];
  raw: string;
}

/** A resolved import reference from a source file. */
export interface ImportReference {
  /** The local name used in this file. */
  name: string;
  /** The original exported name from the source module. */
  originalName: string;
  /** The module specifier (e.g. `'../types'`, `'@scope/pkg'`). */
  source: string;
  /** Whether this is a type-only import. */
  typeOnly: boolean;
}

/** A single source file's extracted data. */
export interface FileEntry {
  filePath: string;
  imports: ImportReference[];
  declarations: Declaration[];
  errors: string[];
}

/** A package.json exports entry point. */
export interface EntryPoint {
  /** The subpath pattern (e.g. `"."`, `"./utils"`). */
  subpath: string;
  /** Resolved source file path(s) relative to sourceDir. */
  resolvedPaths: string[];
  /** Names exported through this entry point. */
  exportedNames: string[];
}

/** The full extraction result. */
export interface ExtractionResult {
  generatedAt: string;
  packageName: string;
  sourceDir: string;
  fileCount: number;
  declarationCount: number;
  entryPoints?: EntryPoint[];
  files: FileEntry[];
}

/** A generated markdown page. */
export interface MarkdownPage {
  fileName: string;
  title: string;
  body: string;
}

/** Options for `generateReferenceDocs`. */
export interface GenerateOptions {
  /** Package directory containing package.json. Defaults to `process.cwd()`. */
  packageDir?: string;
  /** Source directory to scan. Defaults to `src/` within packageDir. */
  sourceDir?: string;
  /** Output directory for generated files. Defaults to `docs/references/` within packageDir. */
  outDir?: string;
  /** Whether to generate the JSON output file. Defaults to `true`. */
  json?: boolean;
  /** Whether to generate markdown pages. Defaults to `true`. */
  markdown?: boolean;
}

/** A parsed comment from the oxc-parser output. */
export interface ParsedComment {
  type: string;
  value: string;
  start: number;
  end: number;
}

/** A re-export found in a file. */
export interface ReExport {
  /** Names being re-exported. Empty array means `export *`. */
  names: string[];
  /** Whether this is `export *` (re-exports everything). */
  star: boolean;
  /** Resolved source file path. */
  source: string;
  /** Original name → exported name mapping for renames. */
  renames: Map<string, string>;
}

/** A matched file from wildcard expansion with the captured stem. */
export interface WildcardMatch {
  /** Absolute path to the matched file. */
  filePath: string;
  /** What the `*` captured (e.g. `"utilities/formatDate"`). */
  stem: string;
}
