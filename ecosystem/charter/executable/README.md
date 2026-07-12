# Charter — Executable

## Purpose

Provide the lifecycle and scope primitive for entities that need explicit initialization, activation, deactivation, and disposal. An executable owns one kernel and shared scoped infrastructure without deciding which lifecycle family inherited plugins receive.

## What It Is

- A guarded asynchronous lifecycle state machine.
- A scope owning a service container, inherited plugin container, kernel runner, telemetry, events, and composed renderable.
- A base for specializations that choose plugin behavior through lifecycle callbacks.
- A parent-capable implementation seam for deliberate specialized scopes.

## What It Is Not

- Not an application or activity.
- Not a plugin lifecycle policy. Merely inheriting plugins never causes their hooks to run.
- Not a public generic scope factory or forking API.
- Not a kernel; it invokes exactly one supplied kernel.
- Not a plugin discovery system.

## Invariants

### Identity

- Implementations use the global `Symbol.for('ai.assistant:Executable')` brand.
- Runtime identity uses the brand rather than `instanceof` across package and realm boundaries.

### Construction

- Construction is synchronous, inert, and returns at `created` state.
- Construction wires scoped infrastructure without invoking callbacks, plugins, or kernel hooks.
- Root scope defaults to `executable`; specializations select their own scope names.
- Static creation and activation factories resolve at `initialized` and `active` state.

### Lifecycle

```text
created → creating → initializing → initialized → activating → active
                                                     ↑             ↓
                                                     └─ inactive ← deactivating

any nonterminal state → disposing → disposed
any lifecycle failure → error
```

- `initialize()` advances only a created scope.
- `activate()` initializes when needed and activates an initialized or inactive scope.
- `deactivate()` advances only an active scope.
- `dispose()` waits for competing transitions, deactivates an active scope, then disposes permanently.
- Every lifecycle method resolves to the same instance.
- `disposed` and `error` are terminal; disposing twice throws.

### Kernel and specialization orchestration

- Every executable owns exactly one kernel.
- Each phase runs the specialization callback first and the corresponding standard kernel hook second.
- Kernels always receive `create`, `ui`, `initialize`, `activate`, `deactivate`, `dispose`, and `error`, regardless of specialization.
- Executable never invokes inherited plugins automatically.
- A specialization callback may use the inherited plugin container to select its lifecycle family and execution strategy.
- This separation prevents global plugin initialization from replaying merely because another specialized executable inherits the plugin.
- Missing callbacks and kernel hooks are skipped.

### Rendering

- Rendering is synchronous and occurs between creation and initialization.
- Composition order is base renderable → specialization callback → kernel wrapper.
- A nullish value returned by either composition layer gates rendering and is retained.
- A specialization may update and recompose its base renderable while active.

### Errors

- Callback and kernel failures normalize to `ApplicationError`, are stored, and are rethrown.
- Before entering `error`, the specialization error callback and kernel error hook are attempted synchronously in that order.
- Secondary error-handler and error-listener failures cannot replace the original failure.

### Concurrency and disposal

- Repeated calls for one in-flight transition execute phase work once.
- Conflicting transitions wait and then reevaluate eligibility.
- A requested disposal prevents new initialization, activation, or deactivation work.
- Disposal attempts the callback, kernel hook, kernel runner, plugin container, service container, telemetry, and parent detachment.
- Cleanup continues after failures; the first failure remains authoritative.
- Specialized children are constructed deliberately by their owning subsystem, not through a public executable fork.

## Constraints

- Environment-agnostic across browsers, servers, workers, and edge runtimes.
- Contains no domain or specialization-specific knowledge.
- The consumed surface lives at `@ai.assistant/contracts/executable`.
- Every implementation runs `@ai.assistant/tests/executable`.
