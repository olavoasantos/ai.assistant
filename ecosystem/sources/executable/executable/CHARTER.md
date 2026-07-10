# Charter — @ai.assistant/executable

## Purpose

Provide the default implementation of the [Executable entity](../../../charter/executable/README.md).

## Implementation Choices

- Lifecycle state, fatal error, base renderable, and composed renderable are stored in `@preact/signals-core` signals. Consumers receive plain status/error accessors and a read-only renderable signal.
- Lifecycle phases are measured by the scope's `@ai.assistant/telemetry` instance using phase names such as `initialize` and `activate`.
- Services use `@ai.assistant/service-container`; ordinary plugins and the kernel use `@ai.assistant/plugin-engine`; lifecycle events use `@ai.assistant/event-emitter`.
- The default kernel is a named plugin with no hooks.
- Empty renderables use Preact's `Fragment` vnode.
- Internal mutable state is stored behind module-local symbols. Only `Executable` and `ExecutableGuard` are public runtime exports.

## Identity

`ExecutableGuard` accepts values branded by `Symbol.for('ai.assistant:Executable')`. It does not use `instanceof`.

## Constraints

- The implementation satisfies `@ai.assistant/contracts/executable` with an explicit `implements` clause.
- It runs the shared compliance suite from `@ai.assistant/tests/executable` as integration tests.
- Source-specific behavior must remain aligned with the entity charter, contract, and compliance suite.
