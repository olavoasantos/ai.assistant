<p align="center">
  <img src="https://github.com/olavoasantos/olavoasantos/blob/latest/.config/assets/logo.png" style="width: 200px; max-width: 25%" />
</p>

<h1 align="center">@local.pkg/config</h1>

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

Shared build, test, lint, and formatting configuration for all workspace packages. This is an internal monorepo package — **never published**.

## Build Presets

### `createViteConfig` (library packages)

```ts
import {createViteConfig} from '@local.pkg/config/build/package';

export default createViteConfig({
  entry: {index: 'src/index.ts'},
  pkg: {name: '@scope/my-lib', version: '1.0.0'},
  scope: '@scope',
});
```

Produces dual CJS/ESM output with sourcemaps, DTS generation, and automatic externalization of workspace packages matching the given scope.

### `createAppViteConfig` (applications)

```ts
import {createAppViteConfig} from '@local.pkg/config/build/app';

export default createAppViteConfig({
  pkg: {name: 'my-app', version: '1.0.0'},
  plugins: [preact()],
});
```

Produces a bundled, minified application build with sourcemaps.

## Testing

Vitest configurations for each test type. Merge with your package's vite config:

| Config                   | File pattern          | Usage                  |
| ------------------------ | --------------------- | ---------------------- |
| `testing/unit.ts`        | `*.unit.ts(x)`        | Isolated module tests  |
| `testing/integration.ts` | `*.integration.ts(x)` | Cross-module tests     |
| `testing/e2e.ts`         | `*.e2e.ts(x)`         | End-to-end tests       |
| `testing/bench.ts`       | `*.bench.ts(x)`       | Performance benchmarks |

## TypeScript

Extend the base config in your package's `tsconfig.json`:

```json
{
  "extends": "@local.pkg/config/typescript/base.json"
}
```

## Linting & Formatting

Each package gets its own `.prettierrc.mjs` and `oxlint.json` that extend the base configs from this package. Use `pnpm scaffold` to generate them automatically.

## Contributors

- [Olavo Amorim Santos](https://github.com/olavoasantos)

### AI Disclosure

Significant portions of this codebase were written with AI coding agents via [pi](https://github.com/badlogic/pi-mono), using OpenAI GPT, Z.ai's GLM, and other models. All AI-generated code was reviewed and approved by a human contributor.
