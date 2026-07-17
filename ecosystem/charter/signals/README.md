# Charter — signals

The platform's reactivity primitive. Not an abstraction over signals. Not a custom reactive system. Preact Signals — specifically `@preact/signals-core` for environment-agnostic code, `@preact/signals` for UI-layer code.

## Purpose

Provide the reactive value container and read-only view types that foundation, domain, and application code depend on. Consumers reference signal types through `@ai.assistant/contracts/signals`; runtime creators (`signal()`, `computed()`, `effect()`, `batch()`) are imported from `@preact/signals-core` directly in implementation code. This charter also governs how signals are produced, exposed, and consumed across the layer model — it is the single source of truth for the reactivity model and its layer constraints.

## What It Is

- The platform's reactivity primitive: `Signal<T>` and `ReadonlySignal<T>`, re-exported from `@preact/signals-core` through `@ai.assistant/contracts/signals` for type references.
- A two-package boundary: `@preact/signals-core` for environment-agnostic code (contracts, foundations, domains), `@preact/signals` for UI-layer code only.
- A set of layer rules for how signals are created, derived, exposed, and observed at each layer of the platform.

## What It Is Not

- Not a custom reactive system. The runtime is Preact Signals; contracts only re-export its types.
- Not a contract that produces runtime signal code. Contracts define the type surface (`Signal<T>`, `ReadonlySignal<T>`) and contain no runtime code.
- Not a general observation system for foundations. Ordinary foundations produce reactive values; only a dedicated, negotiated remote-value adapter governed by explicit authority, finite-resource, and lifecycle guarantees may observe Signal references under the rules below. Effects belong to consumers.

## Invariants

### Two Packages, One Boundary

- **`@preact/signals-core`** — used by contracts, foundations, domains, and any environment-agnostic code. Zero framework coupling.
- **`@preact/signals`** — used by UI-layer code only (apps, components, hooks). Provides Preact VDOM integration.
- Never import `@preact/signals` in foundations or domains. The dependency direction is enforced: if it doesn't render, it uses `-core`.

### Contract Surface

`@ai.assistant/contracts/signals` re-exports `Signal` and `ReadonlySignal` from `@preact/signals-core`. Consumers depend on `@ai.assistant/contracts/signals` for type references.

```typescript
// @ai.assistant/contracts/signals
export type {Signal, ReadonlySignal} from '@preact/signals-core';
```

Rules:

- Consumer code references `Signal<T>` and `ReadonlySignal<T>` via `@ai.assistant/contracts/signals`.
- Runtime creators (`signal()`, `computed()`, `effect()`, `batch()`) are imported from `@preact/signals-core` directly in implementation code. They are not re-exported through contracts.
- Contracts never depend on `@preact/signals` — only on `@preact/signals-core`.

### Public APIs Expose Getters, Not Raw Signals

A getter that reads `.value` makes the property subscribable within `effect()` or `computed()` contexts without coupling the consumer to signals. The signal is an implementation detail.

```typescript
// ✅ Correct — getter hides the signal
class Rating {
  readonly #rating = signal(0);

  get rating(): number {
    return this.#rating.value;
  }
}

// ❌ Wrong — leaks the signal
class Rating {
  readonly rating = signal(0);
}
```

Rules:

- Foundation and domain classes expose signal-backed state as getters.
- The getter's return type is the unwrapped value (`number`, `string`, `T`), never `Signal<T>`.
- **Exception: data sources.** Data sources expose `ReadonlySignal<T>` as the contract because subscribability is the feature. Consumers need the signal reference to wire into their own reactive graph.
- **Exception: Application.ui.** The application's `ui` property exposes `ReadonlySignal<Renderable>` because consumers need the signal reference to embed it in rendering trees. The rendering engine subscribes to the signal directly — unwrapping would defeat reactive embedding.
- **Exception: dedicated remote Signal adapters.** A dedicated, negotiated remote-value adapter may accept and produce Signal references when remote subscribability and synchronization are its explicit feature and explicit authority, finite-resource, and lifecycle guarantees govern it. Remote consumers receive `ReadonlySignal<T>` contracts according to the rules below.

### Dedicated Remote Signal Adapters

A dedicated remote Signal adapter is a narrow negotiated boundary where exposing and observing Signal references is the feature rather than an implementation leak. It operates only within explicit remote authority, finite-resource, and lifecycle guarantees. The official RPC Signals wire plugin is the platform's standard adapter of this kind. Its protocol and implementation-specific constraints belong to the RPC and plugin charters; every remote Signal adapter follows these reactivity invariants:

- An owner may provide `Signal<T>` or `ReadonlySignal<T>`, but a remote consumer receives a `ReadonlySignal<T>` contract and no authority to mutate the owner-side Signal.
- An adapter may create a writable Signal privately for hydration and assign to it when applying authorized snapshots or updates. The consumer contract does not expose that internal write capability.
- If consumer code circumvents the read-only contract and mutates locally writable hydration state, the mutation remains local and non-authoritative. It sends no reverse update and may be replaced by the next authoritative remote value. Owner mutation requires a separate explicit remote operation.
- Initial hydration provides a current value without requiring ongoing owner observation. Observation starts from remote demand and stops after that demand ends.
- Watch and unwatch transitions are coalesced within a finite adapter-defined window. At its end, contradictory pending transitions resolve to at most one transition per Signal, sent only when the final desired state differs from the last transmitted state.
- Updates carry ordering context. Duplicate or stale updates do not change the hydrated value or applied ordering state. A detected gap triggers bounded recovery from authoritative state without applying the uncertain update.
- Signal identities, active watches, source subscriptions, revisions, pending batches, cached values, queued updates, and recovery work are finite and scoped to their remote relationship.
- Final unwatch releases the owner-side source subscription and watch-scoped timers, queues, and recovery work while preserving the hydrated Signal for later observation. Disconnect, failed establishment, and adapter disposal release all relationship-owned bookkeeping; consumer-retained hydrated Signals become stale and receive no further updates.
- Adapter runtime creators come directly from `@preact/signals-core`. Neither the adapter nor its contracts turn `@ai.assistant/contracts/signals` into a runtime creator facade.

This exception does not permit ordinary foundation or domain classes to expose writable Signals, deepen same-instance Signal graphs, or introduce effects. It permits only the bounded observation and private hydration state required to transport a reactive value.

### Signal Graphs Are Shallow

Foundation code keeps signal dependency chains to one level within a single instance: `signal()` → `computed()` → getter.

```typescript
// ✅ Shallow — one level of derivation within the instance
readonly #firstName = signal('');
readonly #lastName = signal('');
readonly #fullName = computed(() => `${this.#firstName.value} ${this.#lastName.value}`);

get fullName(): string {
  return this.#fullName.value;
}
```

Rules:

- `computed()` reads from `signal()` values. Computeds do not read from other computeds within the same instance in foundation code.
- **Cross-instance hierarchical chains are expected.** When a parent-child relationship exists (e.g. telemetry fork trees), a child's computed naturally reads the parent's computed to inherit state. This is the intended pattern for hierarchical data flow and is not subject to the one-level rule.
- Deep computed-of-computed chains within a single instance belong in data sources or services where the complexity is justified and owned by a single module.
- If a derivation chain grows beyond one level within a single instance in a foundation, it is a design smell — break it into separate signals or move the logic to a service.

### No `effect()` in Foundation Code

Ordinary foundations produce reactive values; they do not observe them. Dedicated remote Signal adapters may subscribe directly under their bounded lifecycle rules, but they do not gain permission to create effects. Effects belong to consumers — UI hooks, services, application-level orchestration.

Rules:

- Foundation modules never call `effect()`.
- Domain modules may use `effect()` in services and data sources where side-effect orchestration is their responsibility.
- UI code uses `effect()` (or Preact's `useSignalEffect`) in hooks and application wiring.
- `batch()` is allowed anywhere mutations touch multiple signals atomically.

### Signals Across the Layer Model

How signals fit at each layer of the platform:

| Layer           | Signals package        | Creates signals? | Creates computeds? | Creates effects? | Exposes signals?                                   |
| --------------- | ---------------------- | ---------------- | ------------------ | ---------------- | -------------------------------------------------- |
| **Contracts**   | `@preact/signals-core` | No               | No                 | No               | Types only                                         |
| **Foundations** | `@preact/signals-core` | Yes              | Yes (one level)    | No               | Getters; remote adapters: `ReadonlySignal<T>`      |
| **Domains**     | `@preact/signals-core` | Yes              | Yes                | Services only    | Data sources: `ReadonlySignal<T>`. Others: getters |
| **Apps (UI)**   | `@preact/signals`      | Rarely           | Yes                | Yes              | N/A                                                |

- **Contracts** define the type surface (`Signal<T>`, `ReadonlySignal<T>`) but contain no runtime signal code.
- **Foundations** create and derive reactive state. Ordinary foundations expose it through getters and never observe it. Dedicated remote Signal adapters expose read-only references and observe only while authorized remote demand exists.
- **Domains** compose foundation signals into richer reactive graphs. Data sources are the primary signal-producing surface. Services may use effects to orchestrate cross-data-source coordination.
- **Apps** consume reactive state from domains. Create effects to bridge signals into the rendering cycle. Rarely create new signals — when they do, it is for local UI state only.

## Constraints

- The reactivity runtime is `@preact/signals-core` (and `@preact/signals` in the UI layer). No alternative or wrapper reactive system.
- Contracts re-export types only; they contain no runtime signal code.
- Foundations never call `effect()`; dedicated remote Signal adapters use bounded direct subscriptions only for authorized remote demand.
- Remote Signal adapters expose `ReadonlySignal<T>` contracts, keep writable hydration state private, never infer reverse synchronization from local writes, and release all observation state deterministically.
- Signal dependency chains within a single foundation instance are shallow (one `computed()` level), except for cross-instance hierarchical inheritance.
- The contract lives in `@ai.assistant/contracts/signals`.
