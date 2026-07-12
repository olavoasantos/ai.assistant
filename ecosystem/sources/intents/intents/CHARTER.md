# Charter — @ai.assistant/intents

## Purpose

Provide the default implementation of the [Intents entity](../../../charter/intents/README.md).

## Implementation Choices

- `IntentRegistry` stores intents in a signal and scope templates in a keyed map.
- Registry scope views share intent, template, and root-activity state while carrying a distinct invocation owner and provider container.
- `Intent` stores immutable identity and mutable execution fields behind module-local symbols.
- `Activity` extends `@ai.assistant/executable` with `ServiceProviderLifecycles` and injects callbacks that invoke only activity-specific provider hooks.
- Activity kernels continue through Executable's standard kernel lifecycle.
- `ActivityResponder` is an internal response-channel controller; handlers receive only the responder facade declared by the contract.
- Runtime guards use global symbol brands and the validation foundation.
- Intent URI parsing uses the platform `URLSearchParams` implementation.

## Identity

- Intent: `Symbol.for('ai.assistant:Intent')`.
- Activity: `Symbol.for('ai.assistant:Activity')`.
- Registry: `Symbol.for('ai.assistant:IntentRegistry')`.
- Guards never use `instanceof`.

## Constraints

- Public classes explicitly satisfy their contracts where applicable.
- The source runs `@ai.assistant/tests/intents` as integration tests.
- It depends on Executable rather than Application at runtime, preventing a runtime package cycle.
- It never accesses Executable implementation symbols.
- Source behavior remains aligned with the entity charter, contract, and compliance suite.
