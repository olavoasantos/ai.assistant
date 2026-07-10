<p align="center">
  <img src="https://github.com/olavoasantos/ai.assistant/blob/latest/.config/assets/logo.png" style="width: 200px; max-width: 25%" />
</p>

<h1 align="center">@local.pkg/scaffold</h1>

<p align="center">
  <a href="https://github.com/olavoasantos/ai.assistant/blob/latest/docs">Documentation</a> •
  <a href="https://github.com/olavoasantos/ai.assistant/blob/latest/CONTRIBUTING.md">Contributing</a> •
  <a href="https://github.com/olavoasantos/ai.assistant/blob/latest/CODE_OF_CONDUCT.md">Code of Conduct</a>
</p>

<p align="center">
  <img alt="issues" src="https://img.shields.io/github/issues-search/olavoasantos/{{ORG}}?color=%23F3626C&label=Issues&logo=github&query=is%3Aopen" />
  <img alt="prs" src="https://img.shields.io/github/issues-pr/olavoasantos/{{ORG}}?color=%23F3626C&label=Pull%20requests&logo=github" />
</p>

## About

Scaffolds new packages, apps, examples, and local packages in the monorepo with the correct file structure, configs, and conventions. This is an internal monorepo package — **never published**.

## Usage

```bash
pnpm scaffold package my-lib                               # → packages/my-lib/
pnpm scaffold app my-app --description "My application"     # → apps/my-app/
pnpm scaffold example basic-usage                           # → examples/basic-usage/
pnpm scaffold local my-tool --description "Internal tool"   # → local.pkg/my-tool/
```

Then run `pnpm install` to link the new workspace entry.

## What Gets Created

### `package`

A publishable library with full build, test, lint, and docs tooling:

```
packages/my-lib/
├── .prettierrc.mjs
├── oxlint.json
├── README.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.unit.config.ts
├── vitest.integration.config.ts
├── vitest.bench.config.ts
└── src/
    ├── index.ts
    └── register.d.ts
```

### `app`

A private application with build, dev server, and full test suite:

```
apps/my-app/
├── .prettierrc.mjs
├── oxlint.json
├── README.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.unit.config.ts
├── vitest.integration.config.ts
├── vitest.e2e.config.ts
├── vitest.bench.config.ts
└── src/
    ├── index.ts
    └── register.d.ts
```

### `example`

A minimal project for demonstrating package usage:

```
examples/basic-usage/
├── .prettierrc.mjs
├── oxlint.json
├── README.md
├── package.json
├── tsconfig.json
└── src/
    └── index.ts
```

### `local`

An internal monorepo tool (never published):

```
local.pkg/my-tool/
├── .prettierrc.mjs
├── oxlint.json
├── README.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.unit.config.ts
├── vitest.integration.config.ts
├── vitest.bench.config.ts
└── src/
    ├── index.ts
    └── register.d.ts
```

## Programmatic Usage

```ts
import {scaffold} from '@local.pkg/scaffold';

scaffold('package', 'my-lib', 'A utility library');
```

## Contributors

- [Olavo Amorim Santos](https://github.com/olavoasantos)

### AI Disclosure

Significant portions of this codebase were written with AI coding agents via [pi](https://github.com/badlogic/pi-mono), using OpenAI GPT, Z.ai's GLM, and other models. All AI-generated code was reviewed and approved by a human contributor.
