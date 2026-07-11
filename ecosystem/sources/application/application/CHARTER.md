# Charter — @ai.assistant/application

## Purpose

Provide the default implementation of the [Application entity](../../../charter/application/README.md).

## Implementation Choices

- `Application` extends the default `@ai.assistant/executable` implementation and maps `serviceProviders` to its ordinary plugin container.
- Root scope defaults to `app`; executable child-scope construction supplies the `child` default.
- Application identity uses `Symbol.for('ai.assistant:Application')` and is validated by `ApplicationGuard`.
- Service-provider and kernel factory utilities preserve literal names and support either fixed definitions or caller-supplied factories.
- Lifecycle state, orchestration, rendering, telemetry, events, errors, and inherited infrastructure remain owned by the executable implementation.

## Constraints

- The implementation satisfies `@ai.assistant/contracts/application` with an explicit `implements` clause.
- It runs the shared compliance suite from `@ai.assistant/tests/application` as integration tests.
- It does not access or publish executable implementation symbols.
- It does not contain intent integration or other deferred subsystem wiring.
