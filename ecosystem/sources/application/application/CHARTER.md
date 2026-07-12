# Charter — @ai.assistant/application

## Purpose

Provide the default implementation of the [Application entity](../../../charter/application/README.md).

## Implementation Choices

- `Application` extends `@ai.assistant/executable` with the complete service-provider lifecycle hook map.
- Lifecycle callbacks invoke ordinary provider hooks through the public typed plugin-container surface; Application does not access Executable internals.
- Provider creation, activation, deactivation, and disposal are concurrent; initialization is sequential; rendering is synchronous.
- The root scope defaults to `app`.
- Application identity uses `Symbol.for('ai.assistant:Application')` and is validated by `ApplicationGuard`.
- Construction creates one `@ai.assistant/intents` registry from the configured scope templates and eager definitions.
- Application has no public fork. Specialized child executables choose their own provider lifecycle family.

## Constraints

- `Application` explicitly implements `@ai.assistant/contracts/application`.
- The source runs `@ai.assistant/tests/application` as integration tests.
- Lifecycle transitions, kernel orchestration, telemetry, events, errors, and owned cleanup remain controlled by Executable.
