# Contributing to ai.assistant

Thank you for your interest in contributing! This document covers the process for contributing to this project.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Run `pnpm install`
4. Create a branch for your work

## Development Workflow

```bash
pnpm dev          # Start dev mode
pnpm check        # Run all quality checks (build, lint, format, types, tests)
pnpm fix          # Auto-fix lint and formatting issues
```

## Creating New Packages

Use the scaffold command to create new workspace entries with the correct structure:

```bash
pnpm scaffold package my-lib                    # Library package
pnpm scaffold app my-app                        # Application
pnpm scaffold example my-example                # Example project
pnpm scaffold local my-tool                     # Internal tool
```

## Code Conventions

All conventions are documented in [AGENTS.md](AGENTS.md). Key points:

- **Named exports only** — no default exports
- **One function per utility file** — no helper functions sharing a file
- **Constants in `constants/`** — never declared inline in utility or class files
- **Types in `types/`** — never inline in consuming files
- **`component.tsx`** entry files for UI components — never `index.tsx`
- **No barrel files** outside of `src/index.ts` entry points

## Commit Messages

- No conventional commit prefixes (`feat:`, `fix:`, etc.)
- Imperative mood: "Add search to the sidebar", not "Added search"
- Subject under 72 characters, no trailing period
- Focus on the **why**, not the what

```
Add workspace setup for examples

Examples are treated as workspace packages so they can consume
the library via pnpm link, simulating a real install.
```

## Pull Requests

1. Ensure `pnpm check` passes with no new failures
2. Create a changeset if your changes affect any publishable package's public API: `pnpm changeset`
3. Keep PRs focused — one logical change per PR
4. Write tests for new code

## Changesets

This project uses [Changesets](https://github.com/changesets/changesets) to manage versioning. If your changes affect the public API of any package in `packages/`:

```bash
pnpm changeset
```

Select the affected packages, the bump level (`patch`, `minor`, `major`), and write a consumer-facing description.

Changes to `apps/`, `examples/`, `local.pkg/`, tests, or internal-only code do **not** need changesets.

## Documentation

- Every public export needs JSDoc/TSDoc comments
- Documentation follows the [Diataxis framework](https://diataxis.fr/)
- Reference docs are auto-generated from docblocks via `pnpm docs:generate`

## Questions?

Open an issue for discussion before starting large changes.
