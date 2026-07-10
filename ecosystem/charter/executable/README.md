# Charter — Executable

## Purpose

Provide the lifecycle and scope primitive that other ecosystem entities can extend when they need explicit initialization, activation, deactivation, and disposal. An executable coordinates shared foundation subsystems without defining what a particular application, worker, request, or activity does.

## What It Is

- A lifecycle state machine with guarded asynchronous transitions.
- A scope that owns a service container, plugin container, kernel runner, telemetry, events, and a composed renderable.
- A base class for specializations that inject phase behavior through lifecycle callbacks.
- A parent-child scope model with inherited infrastructure and independent lifecycle state.

## What It Is Not

- Not a domain entity or product entry point.
- Not a scheduler, process manager, or transport.
- Not a kernel. It invokes one kernel but does not define the kernel's execution strategy.
- Not a plugin discovery system. Plugins are supplied as constructed values.

## Invariants

### Identity

- Executable implementations use the global `Symbol.for('ai.assistant:Executable')` brand.
- Runtime identity checks use that brand rather than `instanceof`, so identity survives package duplication and realm boundaries.
- Brand identity is trust-based and intentionally forgeable by code that knows the global symbol key.

### Construction and factories

- Construction creates owned infrastructure and returns synchronously at `created` state.
- Construction never invokes lifecycle callbacks, plugin hooks, or kernel hooks and starts no asynchronous work.
- `Executable.create(options)` constructs and initializes a scope, resolving at `initialized` state.
- `Executable.activate(options)` constructs, initializes, and activates a scope, resolving at `active` state.
- Static factories and `fork()` preserve the runtime subclass when the subclass keeps a compatible constructor.

### Lifecycle

The forward lifecycle is:

```text
created → creating → initializing → initialized → activating → active
                                                     ↑             ↓
                                                     └─ inactive ← deactivating

any nonterminal state → disposing → disposed
any lifecycle failure → error
```

- `initialize()` advances only a `created` scope and is otherwise a no-op in nonterminal states.
- `activate()` initializes a `created` scope first, then activates an `initialized` or `inactive` scope.
- `deactivate()` advances only an `active` scope and is otherwise a no-op in nonterminal states.
- `dispose()` waits for other transitions, deactivates an active scope, then permanently disposes it.
- Every lifecycle method resolves to the same instance.
- `disposed` and `error` are terminal for lifecycle control and forking.
- A second call to `dispose()` throws.

### Phase orchestration

- For `create`, `initialize`, `activate`, `deactivate`, and `dispose`, execution order is: injected lifecycle callback, ordinary plugins, kernel.
- Ordinary plugin `create` hooks run in parallel because registration must not depend on another plugin's unfinished registration.
- Ordinary plugin hooks for every later phase run sequentially in registration and hook-order order.
- Renderable composition is synchronous and occurs between creation and initialization: base renderable → lifecycle renderable callback → ordinary plugin `ui` wrappers → kernel `ui` wrapper.
- A nullish renderable returned by any layer intentionally gates rendering and is retained.
- Missing callbacks or hooks are skipped.

### Events

- The executable emits `executable:initialized`, `executable:activated`, `executable:deactivated`, and `executable:disposed` after the corresponding settled state is visible.
- It emits `executable:errored` after storing the normalized error and entering `error` state.
- Child executable events bubble through the parent executable event tree until the child is disposed and detached.

### Errors

- Any lifecycle callback, ordinary plugin hook, or kernel hook failure is normalized to `ApplicationError`, stored, and rethrown.
- Before entering `error`, the injected error callback and every still-available plugin or kernel error hook are attempted synchronously in that order.
- Secondary failures from error handlers are ignored so they cannot replace the original failure.
- A failure before disposal leaves owned infrastructure available for explicit observation; lifecycle methods cannot recover the scope. Disposal failures still complete best-effort teardown before entering `error`.

### Concurrency

- Repeated calls for the same in-flight transition share its promise and execute hooks once.
- Conflicting transitions wait for in-flight work before reevaluating eligibility.
- Once disposal is requested, initialization, activation, and deactivation do not begin new phase work.

### Forking

- `fork(options)` returns synchronously at `created` state.
- The child receives a live-linked fork of the service container, forked plugin runners with isolated stores, namespaced telemetry, and event bubbling to the parent.
- Child options may add plugins and replace the kernel, lifecycle callbacks, renderable, scope segment, and telemetry options.
- Parent and child lifecycle states are independent. Disposing either does not recursively dispose the other.
- Root scope defaults to `executable`; child scope defaults to `child`.

### Disposal

- Disposal order is: optional deactivation phase → lifecycle dispose callback → ordinary plugin dispose hooks → kernel dispose hook → kernel runner → plugin container → service container → telemetry → parent detachment → `disposed` state → event.
- Owned cleanup continues across subsystem cleanup failures. The first cleanup failure becomes the fatal error after every cleanup attempt has run.
- Children are not recursively disposed.

## Constraints

- Environment-agnostic across browsers, servers, workers, and edge runtimes.
- No domain knowledge.
- Runtime dependencies are limited to other ecosystem foundations, Preact's renderable type/runtime, and signals.
- The consumed surface lives at `@ai.assistant/contracts/executable` and is compiler-checked by source implementations.
- Every implementation runs the shared compliance suite from `@ai.assistant/tests/executable`.
