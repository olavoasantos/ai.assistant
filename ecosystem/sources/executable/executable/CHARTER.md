# Charter — @ai.assistant/executable

## Purpose

Provide the default implementation of the [Executable entity](../../../charter/executable/README.md).

## Implementation Choices

- Lifecycle state, fatal error, base renderable, and composed renderable use signals.
- Lifecycle phases are measured by the scoped telemetry instance.
- Services use `@ai.assistant/service-container`; inherited plugins and the kernel use `@ai.assistant/plugin-engine`; lifecycle events use `@ai.assistant/event-emitter`.
- The plugin container is inherited by specialized child constructors but is never invoked automatically.
- Specialization callbacks decide which plugin hooks and strategies apply; the kernel runner always receives standard executable hooks afterward.
- Empty renderables use Preact's `Fragment` vnode.
- Internal mutable state uses module-local symbols and is not exported.

## Identity

`ExecutableGuard` validates `Symbol.for('ai.assistant:Executable')` rather than using `instanceof`.

## Constraints

- `Executable` explicitly implements `@ai.assistant/contracts/executable`.
- The source runs `@ai.assistant/tests/executable` as integration tests.
- Public generic forking is unsupported; specialized child construction is an implementation seam.
- Source behavior remains aligned with the entity charter, contract, and compliance suite.
