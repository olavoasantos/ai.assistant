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
- `timestamp` is set once at construction as an ISO 8601 string and is immutable.
- Serialization depth is bounded with default `5`.

### Normalization

- `ApplicationError.from(value)` always creates a new `ApplicationError` and preserves `value` as the cause.
- Existing application errors are copied into a fresh instance; metadata is shallow-cloned and issues are retained by reference.
- `ErrorIssue.from(value)` returns existing issues unchanged and wraps native errors as issue causes.

## Constraints

- Environment-agnostic: works in browsers, Node, workers, and edge runtimes.
- Zero external runtime dependencies.
- The contract lives in `@ai.assistant/contracts/error`; this module implements it and the TypeScript compiler enforces alignment.
