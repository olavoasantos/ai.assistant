<p align="center">
  <img src="https://github.com/olavoasantos/ai.assistant/blob/latest/.config/assets/logo.png" style="width: 200px; max-width: 25%" />
</p>

<h1 align="center">ai.assistant</h1>

<p align="center">
  <a href="https://github.com/olavoasantos/ai.assistant/blob/latest/docs">Documentation</a> •
  <a href="https://github.com/olavoasantos/ai.assistant/blob/latest/CONTRIBUTING.md">Contributing</a> •
  <a href="https://github.com/olavoasantos/ai.assistant/blob/latest/CODE_OF_CONDUCT.md">Code of Conduct</a>
</p>

<p align="center">
  <img alt="issues" src="https://img.shields.io/github/issues-search/olavoasantos/ai.assistant?color=%23F3626C&label=Issues&logo=github&query=is%3Aopen" />
  <img alt="prs" src="https://img.shields.io/github/issues-pr/olavoasantos/ai.assistant?color=%23F3626C&label=Pull%20requests&logo=github" />
</p>

## About

Yet another AI agent harness

## Getting Started


```bash
pnpm install
pnpm dev
```

## Monorepo Structure

This is a pnpm monorepo. Workspace packages use the `@ai.assistant/*` scope.

### `packages/`

Shared libraries that may be published to npm. These are the core building blocks of the project — UI components, utilities, domain logic, etc. Each package has its own `package.json`, build config, and test setup. Other packages, apps, and examples import from these using the `@ai.assistant/*` scope.

### `apps/`

Applications — web apps, servers, CLI tools, documentation sites, desktop apps, etc. Apps consume packages but are never published. In a library-focused monorepo, the documentation site typically lives here.

### `examples/`

Small, focused projects that demonstrate how packages are used by real consumers. These simulate an external user's experience — they import from `@ai.assistant/*` packages via workspace links, not relative paths. Useful for testing ergonomics and catching integration issues.

### `local.pkg/`

Internal monorepo tooling — shared build configs, test configs, code generation scripts, and other infrastructure. These are private packages that are **never published**. Every local package has its own README documenting its purpose and usage.

### `docs/`

Project-wide documentation following the [Diataxis framework](https://diataxis.fr/):

- `docs/learn/` — Explanation guides (understanding-oriented)
- `docs/recipes/` — How-to guides (task-oriented)
- `docs/tutorials/` — Tutorials (learning by doing)
- `docs/references/` — API reference (auto-generated from docblocks)

Individual packages may also have their own docs in `packages/<name>/src/docs/`.

### `.ignore/`

Product planning artifacts — design documents, project roadmaps, milestones, and issues. See [AGENTS.md](AGENTS.md) for the full planning structure.

### `.agents/`

AI agent configuration — skills that define workflows for planning, implementation, documentation writing, and code quality checks. Skills are loaded by AI coding agents (Claude, Cursor, Codex, pi, etc.) to follow project-specific conventions.

## Scripts

| Script                  | Description                                                 |
| ----------------------- | ----------------------------------------------------------- |
| `pnpm build`            | Build all packages                                          |
| `pnpm check`            | Build + run all quality checks (lint, format, types, tests) |
| `pnpm dev`              | Start all packages in dev mode                              |
| `pnpm fix`              | Auto-fix lint and formatting issues                         |
| `pnpm test:unit`        | Run unit tests across all packages                          |
| `pnpm test:integration` | Run integration tests across all packages                   |
| `pnpm test:performance` | Run performance benchmarks                                  |

## Tech Stack

- **Runtime:** [Preact](https://preactjs.com/)
- **Language:** [TypeScript](https://www.typescriptlang.org/) (v6, `verbatimModuleSyntax`, `moduleResolution: bundler`)
- **Build:** [Vite](https://vite.dev/)
- **Test:** [Vitest](https://vitest.dev/)
- **Lint:** [oxlint](https://oxc-project.github.io/docs/guide/usage/linter.html)
- **Format:** [oxfmt](https://oxc-project.github.io/docs/guide/usage/formatter.html)
- **Package Manager:** [pnpm](https://pnpm.io/) (workspaces)
- **Versioning:** [Changesets](https://github.com/changesets/changesets)

## Conventions

See [AGENTS.md](AGENTS.md) for the full coding conventions, file structure rules, component architecture, and contribution guidelines. These conventions are enforced by AI agents and human contributors alike.

## Contributors

- [Olavo Amorim Santos](https://github.com/olavoasantos)

### AI Disclosure

Significant portions of this codebase were written with AI coding agents via [pi](https://github.com/badlogic/pi-mono), using Claude Opus 4.6, GPT-5.4, and Gemini 3.1 Pro Preview. All AI-generated code was reviewed and approved by a human contributor.
