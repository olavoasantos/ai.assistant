# Charter — Application

## Purpose

Provide the unique root executable that assembles and runs a system. Application assigns ordinary lifecycle semantics to service providers and owns the root intent registry.

## What It Is

- The root specialization of Executable.
- The lifecycle owner for global service providers and one kernel.
- The root service, telemetry, event, rendering, and intent scope.
- The place where environment-agnostic infrastructure is assembled before domain and client layers use it.

## What It Is Not

- Not the lifecycle state machine; Executable owns transition semantics.
- Not a reusable child scope or public forking API.
- Not a service provider, kernel, or dependency-discovery mechanism.
- Not a home for product or business-domain behavior.
- Not the implementation of intent matching or activities; it owns and exposes that subsystem.

## Invariants

### Identity and root ownership

- Implementations use `Symbol.for('ai.assistant:Application')` in addition to executable identity.
- Exactly one Application is the root of one running system.
- Root scope defaults to `app`.
- Application cannot be publicly forked. Specialized child executables are created by their owning subsystems.

### Lifecycle

- Construction is synchronous and inert at `created` state.
- Static creation and activation factories resolve to Application instances at `initialized` and `active` state.
- Transitions, concurrency, errors, events, rendering, and disposal obey the Executable charter.

### Service providers

- Service providers are inherited plugins whose lifecycle policy belongs to Application.
- For each Application phase, the ordinary provider hook runs before the kernel hook of the same name.
- Provider `create` hooks run concurrently.
- Provider `initialize` hooks run sequentially in provider order.
- Provider `activate`, `deactivate`, and `dispose` hooks run concurrently.
- Provider `ui` hooks compose between the base renderable and kernel wrapper.
- Provider error hooks are attempted synchronously and cannot replace the original failure.
- Provider contexts expose the Application service container.
- Activity-specific hooks on providers are not invoked by Application.

### Intents

- Application constructs and exposes one root intent registry as `application.intents`.
- Scope templates and eager definitions are fixed by Application construction options.
- The registry shares Application providers for lazy resolution, matching, and disambiguation.
- Activities inherit scoped infrastructure from Application but select the activity provider lifecycle family instead of replaying ordinary Application hooks.

## Constraints

- Environment-agnostic across browsers, servers, workers, and edge runtimes.
- Contains no product or business-domain knowledge.
- The consumed surface lives at `@ai.assistant/contracts/application`.
- Every implementation runs `@ai.assistant/tests/application`.
