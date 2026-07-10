# Charter — @ai.assistant/helpers implementation

## Purpose

Provide the concrete utility functions and helper types described by `ecosystem/charter/helpers/README.md`.

## What It Is

- A collection of standalone utility functions, each in its own file under `src/utilities/`.
- A set of shared TypeScript helper types under `src/types/`.
- The runtime home for identifier conventions (`generateId`, `generateGid`, `ensureId`, `ensureGid`), path access utilities, glob compilation, string manipulation, and promise deferral.

## What It Is Not

- Not a contract-with-implementations entity. There is no abstract interface to implement — utility functions are self-specifying.
- Not a domain layer. Every function operates on primitive JavaScript values.

## Why No Contract Strand

Helpers intentionally omits the contract strand. A contract strand exists when consumers depend on an abstract interface that one or more sources implement. Helpers has no such abstraction — `capitalize(str: string): string` is its own specification. The charter explains this decision in detail.

## Invariants

### Contract Alignment

- Shared compliance tests from `@ai.assistant/tests/helpers` run as integration tests for this source package.

### Utility Discipline

- Exactly one function declaration per file. No unexported helpers.
- Types that serve a single utility (`ParsedGid`, `ParsedId`, `Defer`, `GenerateGidOptions`) are colocated with their utility.
- Shared types (`Constructor`, `PathsOf`, `PathValue`, `MaybeAsync`, `Optional`) live in `src/types/`.
- Constants (`ID_PATTERN`, `GID_PATTERN`, `GLOB_TO_REGEX_CACHE`, `GLOB_TO_REGEX_SPECIAL_CHARACTERS`) live in `src/constants/`.

### Identifier Conventions

- Internal identifiers: `prefix:id` (e.g. `ai.assistant:a8b3c9d2`).
- Global identifiers: `prefix://owner/resource/id` (e.g. `gid://ai.assistant/Session/abc123`).
- No segment may contain slashes.
- `ensureId` and `ensureGid` throw `TypeError` on malformed input.

### Glob Compilation

- `globToRegex` compiles `*` as `.*?` (non-greedy any-substring match).
- All other regex special characters are escaped.
- Compiled patterns are cached in `GLOB_TO_REGEX_CACHE`.
- Patterns are anchored with `^...$`.

## Constraints

- Environment-agnostic: works in browsers, Node, workers, and edge runtimes.
- Zero external runtime dependencies.
- No async operations except `defer`, which produces a Promise.
