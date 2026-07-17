# Charter — @ai.assistant/error implementation

## Purpose

Provide the default environment-agnostic implementation of the structured error contract described by `ecosystem/charter/error/README.md` and `@ai.assistant/contracts/error`.

## What It Is

- A concrete `Error` subclass implementation of the `ApplicationError` contract.
- A concrete immutable data-object implementation of the `ErrorIssue` contract.
- The runtime home for error and issue identity guards.
- The default source package consumed by ecosystem, domain, and client code that needs structured errors.

## What It Is Not

- Not a second contract. Consumer-facing shape lives in `@ai.assistant/contracts/error`.
- Not a domain extension point. Domain-specific metadata is added through contract declaration merging.
- Not a logging, transport, or presentation adapter.

## Invariants

### Contract Alignment

- `ApplicationError` implements `Contract.ApplicationError`.
- `ErrorIssue` implements `Contract.ErrorIssue`.
- Shared compliance tests from `@ai.assistant/tests/error` run as integration tests for this source package.

### Identity

- `ApplicationError` instances are identified by a `Symbol.for('ai.assistant:ApplicationError')` brand.
- `ErrorIssue` instances are identified by a `Symbol.for('ai.assistant:ErrorIssue')` brand.
- Application-specific identity checks never use `instanceof`. The guards use symbol presence, surviving multiple package versions, bundler deduplication failures, and realm crossings.

### Defaults

- `code` defaults to `500`.
- `severity` defaults to `'recoverable'`.
- `metadata` defaults to `{}`.
- `timestamp` defaults to the current ISO 8601 time, accepts an explicit known creation time for reconstruction, and is immutable after construction.
- Serialization and deserialization depth default to `5`.

### Normalization

- `ApplicationError.from(value)` always creates a new `ApplicationError` and preserves `value` as the cause.
- Existing application errors are copied into a fresh instance; metadata is shallow-cloned and issues are retained by reference.
- `ErrorIssue.from(value)` returns existing issues unchanged and wraps native errors as issue causes.

### Deserialization

- `ApplicationError.fromJSON(value)` reconstructs valid serialized errors and rejects malformed input with a fresh `ApplicationError` that does not retain the rejected value.
- Parsing reads only own data-property descriptors from ordinary or null-prototype materialized records. Custom prototypes and accessors on consumed fields are rejected without invoking ordinary getters.
- Metadata and paths are defensively cloned, traversed cycles are rejected, and causes and issues beyond the configured finite depth are omitted without traversal.
- Serialized timestamps replace constructor timestamps. Constructor-generated stacks are removed unless an explicit serialized stack is present.
- Reconstructed application errors and issues receive the same global symbol brands as locally constructed instances.
- A leaf issue cause containing only message and optional stack reconstructs as a native `Error`; without a discriminator it is structurally indistinguishable from a minimal `ErrorIssue`.

## Constraints

- Object input is a materialized JSON-compatible envelope produced by parsing or structured clone. Same-realm JavaScript `Proxy` traps cannot be made inert by reflective inspection and proxies are outside the serialized representation.
- Environment-agnostic: works in browsers, Node, workers, and edge runtimes.
- Zero external runtime dependencies.
- The contract lives in `@ai.assistant/contracts/error`; this module implements it and the TypeScript compiler enforces alignment.
