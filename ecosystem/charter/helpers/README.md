# Charter — @ai.assistant/helpers

## Purpose

A collection of small, environment-agnostic utility functions and types shared across the platform. Helpers covers string manipulation, object path access, identifier generation and parsing, glob compilation, and promise deferral — the kinds of operations that every subsystem needs but that are too small to warrant their own package.

## What It Is

- A grab-bag of standalone utility functions, each in its own file, exported via the package barrel and individual subpath exports.
- A set of shared TypeScript helper types (`Constructor`, `PathsOf`, `PathValue`, `MaybeAsync`, `Optional`).
- The runtime home for identifier conventions (`generateId`, `generateGid`, `ensureId`, `ensureGid`) that the rest of the platform relies on for traceable, parseable references.

## What It Is Not

- Not a contract-with-implementations entity. Utility functions are concrete and self-specifying — their type signature IS the contract. There is no swappable `Capitalizer` interface to implement against.
- Not a domain layer. It knows nothing about agents, sessions, tools, or product. Every function operates on primitive JavaScript values.
- Not a framework or subsystem. It has no lifecycle, no state, no side effects beyond those documented on individual utilities.

## Why No Contract Strand

Most ecosystem entities follow the four-strand helix: charter, contract, tests, source. Helpers intentionally omits the contract strand. A contract strand exists when consumers depend on an abstract interface that one or more sources implement — `ApplicationError`, `Rule`, `EventEmitter`. Helpers has no such abstraction. `capitalize(str: string): string` is its own specification; there is nothing to swap or comply with beyond the function itself.

The shared type-level contracts that helpers-adjacent code needs (`Timestamp`, `MaybeAsync`) live in `@ai.assistant/contracts/utilities`, which serves all contract strands, not just helpers.

## Invariants

### Utility Discipline

- Exactly one function declaration per file. No unexported helpers, no companion utilities.
- Types that serve a single utility (`ParsedGid`, `ParsedId`, `Defer`, `GenerateGidOptions`) are colocated with their utility. Shared types (`Constructor`, `PathsOf`, `PathValue`, `MaybeAsync`, `Optional`) live in `types/`.
- Constants live in `constants/`, never inline in utility files.
- Every public export has TSDoc/JSDoc.

### Purity and Side Effects

- String, path, glob, and slug utilities are pure: same input → same output, no mutation, no I/O.
- `setPath` and `deletePath` mutate their `target` argument in place. This is documented and intentional — they operate on nested object trees by reference.
- `generateId`, `generateGid`, and `generateRandomString` are non-deterministic by design. They produce random suffixes. Uniqueness is probabilistic, not guaranteed.

### Identifier Conventions

- Internal identifiers use `prefix:id` format (e.g. `ai.assistant:a8b3c9d2`). Parsed by `ensureId`.
- Global identifiers use `prefix://owner/resource/id` format (e.g. `gid://ai.assistant/Session/abc123`). Parsed by `ensureGid`.
- No segment in either identifier format may contain slashes — identifiers are round-trippable via `new URL()` where applicable.
- `ensureId` and `ensureGid` throw `TypeError` on malformed input. They do not return partial results.

### Glob Compilation

- `globToRegex` compiles `*` as a wildcard matching any substring.
- All other regex special characters are escaped and treated literally.
- Compiled patterns are cached by glob string. Repeated calls with the same glob return the same `RegExp` instance.
- Patterns are anchored (`^...$`) — partial matches are rejected.

### Path Access

- `getPath` accepts dot-and-bracket notation (`'user.profile.name'`, `'items[0].name'`).
- `setPath` accepts a pre-split string array (`['user', 'profile', 'name']`).
- `deletePath` accepts dot notation (`'user.profile.name'`).
- All three are no-ops when an intermediate segment is missing or not an object — they never throw for missing paths.

## Constraints

- Environment-agnostic: works in browsers, Node, workers, and edge runtimes.
- Zero external runtime dependencies.
- No async operations except `defer`, which produces a Promise.
- The package is a source-only entity. Shared type-level contracts live in `@ai.assistant/contracts/utilities`; this module provides the concrete implementations.
