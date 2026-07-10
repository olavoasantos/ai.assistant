# Charter — @ai.assistant/telemetry implementation

## Purpose

Provide the default environment-agnostic implementation of the telemetry contract described by `ecosystem/charter/telemetry/README.md` and `@ai.assistant/contracts/telemetry`.

## What It Is

- A Performance API-backed implementation of the `Telemetry` contract.
- The runtime home for the telemetry identity guard.
- The default source package consumed by ecosystem, domain, and client code that needs metrics collection.

## What It Is Not

- Not a second contract. Consumer-facing shape lives in `@ai.assistant/contracts/telemetry`.
- Not a transport, aggregation engine, or logging adapter. It produces metric entries; something else transports them.
- Not domain-aware. It knows nothing about users, agents, or product. Domain metric names are chosen by consumers.

## Invariants

### Contract Alignment

- `Telemetry` implements `Contract.Telemetry`.
- Shared compliance tests from `@ai.assistant/tests/telemetry` run as integration tests for this source package.
- Behavioural invariants (timer lifecycle, mark/measure, flush cascading, fork semantics, tag resolution, freeze, dispose) are defined in the agnostic charter and asserted by the compliance suite.

### Identity

- `Telemetry` instances are identified by a `Symbol.for('ai.assistant:Telemetry')` brand.
- Application-specific identity checks never use `instanceof`. The guard uses symbol presence via a validation rule, surviving multiple package versions, bundler deduplication failures, and realm crossings.

### Performance API Integration

- All timing measurements use `performance.mark()` and `performance.measure()` for accuracy and devtools timeline visibility.
- Duration is computed via `performance.measure()`, not manual subtraction.
- Performance marks and measures are cleaned up after timer completion (stop, fail, or cancel) and bulk-cleaned on dispose.

### Tag Reactivity

- Default tags are live-linked through the fork chain via `@preact/signals-core` signals: a parent's tag changes propagate to all descendants automatically through a computed signal chain.

## Constraints

- Zero external runtime dependencies beyond other foundations (`@ai.assistant/error`, `@ai.assistant/event-emitter`, `@ai.assistant/helpers`, `@ai.assistant/validation`) and the platform's reactive primitive (`@preact/signals-core`).
- Requires a global `performance` object with `mark()`, `measure()`, `clearMarks()`, and `clearMeasures()` support (Node 16+, all modern browsers, Web Workers).
- Environment-agnostic beyond the `performance` requirement.
- No async in the public API. All operations are synchronous. `measureCallback` returns a promise only when given an async callback.
- The contract lives in `@ai.assistant/contracts/telemetry`; this module implements it and the TypeScript compiler enforces alignment.
