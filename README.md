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

`ai.assistant` is a TypeScript application framework and agent harness organized around contract-driven ecosystem primitives, domain packages, and client entry points.

The ecosystem layer follows a helix discipline: each entity keeps its purpose, consumed surface, compliance tests, and implementations in separate but mirrored strands.

## Getting Started

```bash
pnpm install
pnpm build
pnpm run check
```

Start local infrastructure only when a client or integration needs it; see [Local Infrastructure](#local-infrastructure).

For active development:

```bash
pnpm dev
```

## Monorepo Structure

This is a pnpm monorepo. Product and ecosystem workspace packages use the `@ai.assistant/*` scope. Internal tooling uses the `@local.pkg/*` scope.

| Directory               | Purpose                                                               |
| ----------------------- | --------------------------------------------------------------------- |
| `ecosystem/charter/`    | Implementation-agnostic charters for ecosystem entities               |
| `ecosystem/contracts/`  | TypeScript contract strand consumed by implementations                |
| `ecosystem/tests/`      | Shared compliance tests and test utilities                            |
| `ecosystem/sources/*/*` | Concrete source implementations of ecosystem entities                 |
| `domains/*`             | Domain/business logic built on ecosystem contracts and sources        |
| `clients/*`             | User-facing applications and service entry points                     |
| `infrastructure/*`      | Local development infrastructure for clients and service integrations |
| `internal/*`            | Internal monorepo tooling                                             |
| `docs/`                 | Project documentation using Diataxis                                  |
| `.ignore/`              | Product planning artifacts                                            |
| `.agents/`              | Agent skills and workflow configuration                               |

## Ecosystem Helix Layout

Ecosystem entities mirror across four strands:

```text
ecosystem/
├── charter/<entity>/README.md
├── contracts/<entity>/index.ts
├── tests/<entity>/index.ts
└── sources/<entity>/<source>/
```

Example:

```text
ecosystem/
├── charter/error/README.md
├── contracts/error/index.ts
├── tests/error/index.ts
└── sources/error/error/
```

Strands have separate responsibilities:

- `charter/` defines purpose, invariants, and constraints.
- `contracts/` defines the TypeScript surface consumers depend on.
- `tests/` defines shared compliance tests and test utilities.
- `sources/` contains concrete implementations.

`ecosystem/contracts` and `ecosystem/tests` intentionally keep entry points at the package root rather than under `src/`. Source packages under `ecosystem/sources/<entity>/<source>/` use normal `src/` package layout.

## Scaffolding

Use the scaffold command for supported workspace entries:

```bash
pnpm scaffold client my-client
pnpm scaffold implementation error error
pnpm scaffold local my-tool
```

The implementation scaffold creates source packages at:

```text
ecosystem/sources/<entity>/<source>/
```

After scaffolding, run `pnpm install` and fill in the matching charter, contract, and compliance-test strands as needed.

## Local Infrastructure

The `infrastructure/` folder provides local Docker Compose services for developing clients and service integrations. It is intentionally broad so clients can opt into analytics, logging/error reporting, email capture, monitoring, storage, search, authentication, feature flags, cache, and database services as needed.

Root commands manage the Compose files listed in `.services`:

```bash
pnpm infra:certificates  # generate local HTTPS certs for aiassistant.test
pnpm infra:start         # start local infrastructure
pnpm infra:build         # rebuild and start local infrastructure
pnpm infra:stop          # stop local infrastructure
```

Most browser-facing tools are available through `https://*.aiassistant.test` via the local Nginx reverse proxy. See [infrastructure/README.md](infrastructure/README.md) for the service catalog and setup details.

## Scripts

| Script                    | Description                                                         |
| ------------------------- | ------------------------------------------------------------------- |
| `pnpm build`              | Build all workspace packages that define a build script             |
| `pnpm run check`          | Run workspace lint, format, type, and test checks where defined     |
| `pnpm dev`                | Start package dev/watch tasks where defined                         |
| `pnpm fix`                | Auto-fix lint and formatting issues where supported                 |
| `pnpm docs:generate`      | Generate reference documentation from public docblocks              |
| `pnpm test:unit`          | Run unit tests across workspace packages                            |
| `pnpm test:integration`   | Run integration tests across workspace packages                     |
| `pnpm test:performance`   | Run performance benchmarks                                          |
| `pnpm type:check`         | Run TypeScript checks across workspace packages                     |
| `pnpm infra:certificates` | Generate local HTTPS certificates for `aiassistant.test`            |
| `pnpm infra:start`        | Start local Docker infrastructure listed in `.services`             |
| `pnpm infra:build`        | Rebuild and start local Docker infrastructure listed in `.services` |
| `pnpm infra:stop`         | Stop local Docker infrastructure listed in `.services`              |
| `pnpm version:create`     | Create a changeset                                                  |
| `pnpm version:bump`       | Apply pending changesets                                            |

## Tech Stack

- **Language:** [TypeScript](https://www.typescriptlang.org/) with `verbatimModuleSyntax` and `moduleResolution: bundler`
- **Build:** [Vite](https://vite.dev/)
- **Test:** [Vitest](https://vitest.dev/)
- **Lint:** [oxlint](https://oxc-project.github.io/docs/guide/usage/linter.html)
- **Format:** [oxfmt](https://oxc-project.github.io/docs/guide/usage/formatter.html)
- **Local Infrastructure:** [Docker Compose](https://docs.docker.com/compose/) with Nginx reverse proxy
- **Package Manager:** [pnpm](https://pnpm.io/) workspaces
- **Versioning:** [Changesets](https://github.com/changesets/changesets)

## Conventions

See [AGENTS.md](AGENTS.md) for coding conventions, file structure rules, component architecture, helix reconciliation, and contribution guidelines. These conventions are enforced by AI agents and human contributors alike.

## Contributors

- [Olavo Amorim Santos](https://github.com/olavoasantos)

### AI Disclosure

Significant portions of this codebase were written with AI coding agents via [pi](https://github.com/badlogic/pi-mono), using OpenAI GPT, Z.ai's GLM, and other models. All AI-generated code was reviewed and approved by a human contributor.
