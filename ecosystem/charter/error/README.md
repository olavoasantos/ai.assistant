# Charter — @ai.assistant/error

## Purpose

A structured error primitive for the entire platform. Any thrown value anywhere in the system can be normalized into a consistent, inspectable, serializable shape without information loss.

## What It Is

- The single error representation for all framework and application code.
- A normalization boundary: unknown caught values go in, `ApplicationError` comes out.
- An aggregation container: collects child issues from parallel or sequential operations.
- A serialization target: converts to depth-controlled JSON for logging, transport, and display.
- A deserialization boundary: reconstructs serialized errors without trusting remote objects, prototypes, or references.

## What It Is Not

- Not a logging framework. It produces serializable data; something else decides where it goes.
- Not an error reporting/tracking system. It doesn't phone home.
- Not a retry mechanism. It carries severity hints; the caller decides what to do.
- Not domain-aware. It knows nothing about users, or HTTP. Numeric codes follow HTTP conventions as a widely-known vocabulary, not because it's coupled to HTTP.

## Invariants

### Normalization

- `ApplicationError.from(value)` always returns a **new** `ApplicationError`. It never returns the input, never monkey-patches, never mutates.
- Any value is accepted: `ApplicationError`, `Error`, `string`, object with `.message`, `null`, `undefined`, primitives. Nothing throws.
- The original value is preserved as `.cause` for forensic inspection.
- When normalizing an existing `ApplicationError`, all fields are copied (code, severity, reference, metadata, issues). Metadata is shallow-cloned to prevent cross-mutation.

### Aggregation

- Issues are `ErrorIssue` instances — lightweight data objects with `message`, optional `path`, optional `cause`.
- `ErrorIssue` shape is compatible with the Standard Schema `Issue` convention, making it interoperable with Zod, Valibot, ArkType, and any library producing `{ message, path? }`.
- `ErrorIssue.from()` is idempotent on existing issues (returns same reference) but creates new instances from `Error`.
- The `issues` array is exposed as read-only. Mutation goes through `add()`, `addMany()`, and `removeAll()`.

### Mutation

- Only four fields are mutable post-construction: `code`, `severity`, `reference`, `metadata`.
- `set(key, value)` replaces the field (including metadata — full replacement).
- `setMany(options)` merges metadata with existing values; replaces other fields.
- This asymmetry is intentional: multiple layers enriching metadata independently should compose, not clobber.

### Serialization

- `toJSON()` produces a plain object safe for `JSON.stringify`.
- Stack traces are excluded by default. Opt-in via `{ includeStack: true }`.
- Depth is bounded. Prevents infinite recursion in deep cause chains or circular-like nesting.
- Optional fields (`reference`, `issues`, `cause`, `stack`) are omitted from output when absent — no `null` noise.

### Deserialization

- Canonical deserialization accepts untrusted serialized input and returns a new symbol-branded `ApplicationError`.
- Message, code, severity, reference, JSON-compatible metadata, timestamp, issues, and causes are reconstructed from valid serialized fields. Unknown fields do not become properties on the error.
- Materialized serialized records are read only through their own data properties. Inherited values and custom prototypes are rejected; accessors on consumed fields are rejected without invoking ordinary getters.
- Metadata, issue paths, issues, and causes are rebuilt into fresh structures. Mutating the input after deserialization cannot mutate the reconstructed error.
- Cause and issue traversal has an independent finite depth. Cycles encountered within that traversal are rejected; deeper values are omitted without traversal.
- A reconstructed error has no stack unless the serialized input contains an explicit stack.
- Malformed input is rejected as a fresh `ApplicationError` that retains no reference to the rejected value.
- A leaf issue cause containing only message and optional stack reconstructs as a native `Error`; without a discriminator it is structurally indistinguishable from a minimal `ErrorIssue`.

## Extensibility

The `ErrorMetadata` interface in `@ai.assistant/contracts` is an empty `Record<string, unknown>` by default. Domain packages extend it via module augmentation in their `register.d.ts`:

```typescript
declare module '@ai.assistant/contracts' {
  interface ErrorMetadata {
    userId?: string;
    requestId?: string;
  }
}
```

This keeps the foundation generic while giving domains type-safe metadata fields.

## Constraints

- Zero external runtime dependencies.
- Environment-agnostic: works in browsers, Node, workers, edge runtimes.
- No async. All operations are synchronous.
