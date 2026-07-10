---
name: work-on-ecosystem-entity
description: Work on an ecosystem entity organized by helix strands "charter, contracts, tests, and sources". Use when adding or changing ecosystem contracts, shared compliance tests, source implementations, or entity charters.
---

# Work on Ecosystem Entity

Use this skill when the task touches `ecosystem/charter`, `ecosystem/contracts`, `ecosystem/tests`, or `ecosystem/sources`.

The goal is to keep the four helix strands synchronized while preserving the repository's mirrored entity layout.

## Inputs

The user may provide:

- An entity name, such as `error`.
- A source path, such as `ecosystem/sources/error/error`.
- A request to add or change an ecosystem contract, compliance suite, or implementation.

If the entity or source is ambiguous, ask before editing.

## Layout

Ecosystem entities mirror across four strands:

```text
ecosystem/
├── charter/<entity>/README.md
├── contracts/<entity>/index.ts
├── tests/<entity>/index.ts
└── sources/<entity>/<source>/
```

Strand responsibilities:

- `charter/` — implementation-agnostic purpose, invariants, and constraints.
- `contracts/` — TypeScript consumer surface. Types and interfaces only; no runtime behaviour.
- `tests/` — shared compliance tests and utilities for all source implementations.
- `sources/` — concrete implementations. A source may have its own `CHARTER.md` for implementation-specific invariants.

## Required Reading Order

Before changing files, read completely:

1. `AGENTS.md`.
2. `ecosystem/charter/README.md`.
3. `ecosystem/charter/<entity>/README.md` when it exists.
4. `ecosystem/contracts/<entity>/index.ts` when it exists.
5. `ecosystem/tests/<entity>/index.ts` when it exists.
6. `ecosystem/sources/<entity>/<source>/CHARTER.md` when it exists.
7. The relevant source implementation and local tests.

If a required strand is missing for an existing entity, classify whether that absence is intentional, stale, or blocking before proceeding.

## Workflow

1. Run `pnpm run check` before starting. Record any pre-existing failure.
2. Identify the entity and source implementation being changed.
3. Classify the change as behavioural or non-behavioural using the helix discipline.
4. Make the smallest coherent change across the necessary strands.
5. For behavioural changes, reconcile every strand:
   - Charter: updated or checked unchanged.
   - Contract: updated or checked unchanged.
   - Tests: updated or checked unchanged.
   - Implementation: updated or checked unchanged.
6. Run targeted checks while iterating.
7. Run `pnpm run check` before finishing.
8. Report reconciliation status with file evidence.

## Dependency Direction

- `ecosystem/contracts` imports no source implementations.
- `ecosystem/tests` may import contracts and test libraries, but not source implementations.
- `ecosystem/sources/*/*` may import contracts and shared compliance tests.
- Source implementations should satisfy contracts with TypeScript `implements` clauses where applicable.
- Shared compliance tests from `ecosystem/tests/<entity>` should run in source packages as integration tests.

## Source Naming

Source packages live at `ecosystem/sources/<entity>/<source>/`.

Examples:

- `ecosystem/sources/error/error` — default error implementation.
- `ecosystem/sources/storage/memory` — in-memory storage implementation.
- `ecosystem/sources/storage/indexed-db` — IndexedDB storage implementation.

Use `pnpm scaffold implementation <source> <entity>` when creating a new source package. For example, `pnpm scaffold implementation error error` creates `ecosystem/sources/error/error/`.

Do not flatten this path and do not move root-level `ecosystem/contracts` or `ecosystem/tests` files into `src/` unless the user explicitly asks to redesign the ecosystem layout.

## Checks

Useful targeted checks:

```bash
pnpm --filter @ai.assistant/contracts run check
pnpm --filter @ai.assistant/tests run check
pnpm --filter <source-package-name> run check
```

If a source package consumes updated shared compliance tests, build `@ai.assistant/tests` before checking the source package unless the root build has already run.

Always finish with:

```bash
pnpm run check
```
