<p align="center">
  <img src="https://github.com/olavoasantos/olavoasantos/blob/latest/.config/assets/logo.png" style="width: 200px; max-width: 25%" />
</p>

<h1 align="center">@local.pkg/generate-reference-docs</h1>

<p align="center">
  <a href="https://github.com/olavoasantos/olavoasantos/blob/latest/docs">Documentation</a> •
  <a href="https://github.com/olavoasantos/olavoasantos/blob/latest/CONTRIBUTING.md">Contributing</a> •
  <a href="https://github.com/olavoasantos/olavoasantos/blob/latest/CODE_OF_CONDUCT.md">Code of Conduct</a>
</p>

<p align="center">
  <img alt="issues" src="https://img.shields.io/github/issues-search/olavoasantos/olavoasantos?color=%23F3626C&label=Issues&logo=github&query=is%3Aopen" />
  <img alt="prs" src="https://img.shields.io/github/issues-pr/olavoasantos/olavoasantos?color=%23F3626C&label=Pull%20requests&logo=github" />
</p>

## About

Generates API reference documentation from TypeScript source files. This is an internal monorepo package — **never published**.

## How It Works

1. Reads `package.json` to discover entry points from the `exports` field
2. Traces the public API through re-exports to find all reachable declarations
3. Parses source files with [oxc-parser](https://github.com/nicolo-ribaudo/oxc-parser) to extract declarations and JSDoc docblocks
4. Generates markdown reference pages (one per entry point) and a JSON index

## CLI Usage

```bash
# From any package directory with a package.json
generate-reference-docs

# With options
generate-reference-docs --source-dir src --out-dir docs/references
generate-reference-docs --no-json       # Skip JSON output
generate-reference-docs --no-markdown   # Skip markdown output
```

### Output

```
docs/references/
├── README.md           # Main entry point API docs
├── utils.md            # ./utils entry point (if exists)
└── references.json     # Full extraction result as JSON
```

## Programmatic Usage

```ts
import {generateReferenceDocs} from '@local.pkg/generate-reference-docs';

const result = generateReferenceDocs({
  packageDir: process.cwd(),
  sourceDir: 'src',
  outDir: 'docs/references',
  json: true,
  markdown: true,
});

console.log(`${result.declarationCount} declarations from ${result.fileCount} files`);
```

## JSON Output

The `references.json` file contains the full extraction result including:

- All entry points with their exported names
- Every declaration with its kind, docblock, type parameters, members, and referenced types
- Import graph for each processed file

This is useful for search indexing, IDE tooling, API diffing between versions, and providing AI agents with full API context.

## Adding to a Package

Add the script to your package's `package.json`:

```json
{
  "scripts": {
    "docs:generate": "generate-reference-docs"
  }
}
```

The tool requires that the package has an `exports` field (or `main`/`types`/`module` fallback) in its `package.json` so it knows which files constitute the public API.

## Contributors

- [Olavo Amorim Santos](https://github.com/olavoasantos)

### AI Disclosure

Significant portions of this codebase were written with AI coding agents via [pi](https://github.com/badlogic/pi-mono), using OpenAI GPT, Z.ai's GLM, and other models. All AI-generated code was reviewed and approved by a human contributor.
