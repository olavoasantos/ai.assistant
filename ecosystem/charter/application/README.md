# Charter — Application

## Purpose

Provide the canonical top-level executable scope used to assemble and run a system. An application gives infrastructure plugins the service-provider role and preserves the lifecycle, rendering, telemetry, and child-scope guarantees of the executable entity.

## What It Is

- An executable specialization for a running system's root orchestration scope.
- The lifecycle owner for service providers and one kernel.
- A parent for independently controlled child application scopes.
- The place where environment-agnostic infrastructure is assembled before domain and client layers use it.

## What It Is Not

- Not the lifecycle state machine; the executable entity owns lifecycle semantics.
- Not a service provider or kernel; it orchestrates supplied instances.
- Not a dependency-discovery mechanism; providers and kernels are supplied explicitly.
- Not a home for product or business-domain behavior.
- Not an intent dispatcher. Intent integration is outside this entity until that system has an independent, non-circular contract.

## Invariants

### Identity

- Application implementations use the global `Symbol.for('ai.assistant:Application')` brand in addition to executable identity.
- Runtime identity checks use the application brand rather than `instanceof`, preserving identity across package copies and realm boundaries.

### Construction and lifecycle

- Construction is synchronous and inert at `created` state.
- Root scope defaults to `app`; forked scope defaults to `child`.
- Static creation and activation factories return application instances at `initialized` and `active` state respectively.
- Application lifecycle transitions, concurrency, errors, events, disposal, and renderable composition obey the executable charter.

### Service providers

- `serviceProviders` are the ordinary plugins of the underlying executable scope.
- Provider hooks execute exactly once per eligible phase.
- Creation hooks run concurrently. Initialize, activate, deactivate, and dispose hooks run sequentially in provider order.
- Providers run before the kernel in every phase.
- Provider `ui` hooks compose between the base renderable and the kernel wrapper.
- Provider hook contexts expose the scope's service container.

### Forking

- `fork(options)` returns an Application synchronously at `created` state.
- Child applications inherit forked service and provider infrastructure, namespaced telemetry, and event bubbling while retaining independent lifecycle state.
- Child options may add service providers and replace the kernel, renderable, scope segment, and telemetry settings.
- Forking never exposes executable specialization callbacks through application options.

## Constraints

- Environment-agnostic across browsers, servers, workers, and edge runtimes.
- Contains no product or business-domain knowledge.
- The consumed surface lives at `@ai.assistant/contracts/application` and is compiler-checked by implementations.
- Every implementation runs the shared compliance suite from `@ai.assistant/tests/application`.
