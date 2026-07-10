# Charter — service-container

## Purpose

Provide the contract surface and behavioural invariants for a typed dependency injection container with fork semantics, shared by all framework and application code. Any subsystem that needs to resolve services without knowing who provides them uses this single mechanism. The framework is service-provider-driven — providers register capabilities, consumers resolve them, neither knows about the other directly. Consumers depend on `@ai.assistant/contracts/service-container`; one or more source packages implement it and run the shared compliance tests from `@ai.assistant/tests/service-container`.

## What It Is

- The single service resolution mechanism for all framework and application code.
- A four-mode binding system: value (pre-built), singleton (once at registering scope), scoped (factory inherited, instance per-scope), transient (fresh every time).
- A fork-and-inherit system with live-link semantics: child sees parent bindings registered after fork, local overrides shadow without affecting parent.
- A circular dependency detector at resolution time.
- An observable system: extends the event emitter for wiring into the framework's event tree.

## What It Is Not

- Not a service locator pattern (though it can be used as one). The intent is constructor/factory injection via the container reference.
- Not async. All resolution is synchronous. Factories are synchronous. Only disposal is async.
- Not a plugin/module loader. It does not discover or import services. Registration is explicit.
- Not domain-aware. It knows nothing about users, agents, or product. Service namespaces are declared by consumers via module augmentation.

## Invariants

### Identity

- `ServiceContainer` instances are identified by a `Symbol.for('ai.assistant:ServiceContainer')` brand.
- Identity checks never use `instanceof`. Guards use symbol presence via validation rules, surviving multiple package versions, bundler deduplication failures, and realm crossings.
- Brand identity is trust-based: objects without the brand symbol are rejected, but any code that knows the brand key string can forge acceptance. This is the deliberate `Symbol.for()` trade-off shared across all foundation modules.

### Resolution Semantics

#### Value Bindings

- The instance is stored immediately at registration time.
- Resolution returns the same reference every time.
- In forked containers, the parent's value is inherited by reference (same object).
- No factory is invoked at resolution time.

#### Singleton Bindings

- The factory runs once on first resolution at the registering scope.
- The cached instance is inherited by all descendant scopes (they resolve via parent chain, hitting the parent's cache).
- Re-registering at the same namespace overwrites the binding (clears cached value).

#### Scoped Bindings

- The factory definition is inherited by child scopes via live-link.
- Each scope lazily creates and caches its own instance on first resolution.
- The factory receives the resolving container (the child), not the registering container.
- Child scope instances are fully independent of parent scope instances.

#### Transient Bindings

- The factory runs on every resolution, never cached.
- The factory definition is inherited by child scopes via live-link.
- The factory receives the resolving container.

### Circular Dependency Detection

- Maintained per top-level resolution call (not globally).
- If namespace A's factory resolves namespace B, and B's factory resolves A, throws immediately.
- The resolution set is cleaned up after each top-level resolution completes (no stale state).
- The error message includes the full dependency chain for debugging.

### Fork Semantics (Live-Link Inheritance)

- `fork()` creates a child container linked to the parent via a parent pointer.
- Resolution walks: local bindings first → parent chain (live lookup, not snapshot).
- Bindings registered on the parent AFTER fork are visible to the child.
- Local bindings in the child shadow parent bindings without affecting the parent.
- When a scoped binding is resolved in a child, the child copies the binding definition locally with a fresh cache slot, then resolves against itself.
- Value and singleton bindings resolved in a child delegate to the parent (parent owns the cache).
- Transient bindings resolved in a child invoke the factory with the child as the container argument.
- `fork()` optionally accepts initial value bindings for the child.
- Fork wires the child as an event emitter child (events bubble to parent).

### Freeze Behavior

- `freeze()` prevents `set()`, `value()`, `singleton()`, `scoped()`, `transient()`. Attempts throw.
- Read operations (`ensure`, `get`, `getOr`, `has`, `missing`) remain available.
- `fork()` remains available on a frozen container (children can still be created).
- Freeze is one-way. There is no unfreeze.
- Returns a `ReadonlyServiceContainer` view.

### Dispose Behavior

- `dispose()` is terminal. After disposal, all public methods throw.
- Dispose order: set disposed flag → call registered disposers on all resolved singleton/scoped bindings → clear all cached values → detach from parent event emitter.
- Children are detached but NOT recursively disposed.
- Disposers run via `Promise.allSettled` (one failing disposer does not block others).
- Calling `dispose()` on an already-disposed instance throws.
- Only bindings that were actually resolved (have a cached value) get their disposer called.

### EventEmitter Integration

- The container extends the event emitter for hierarchical event wiring.
- Fork establishes parent-child relationship on the event tree.
- Events are primarily for error observability, not service lifecycle.

## Extensibility

The `Services` interface in `@ai.assistant/contracts` is empty by default. Packages extend it via module augmentation in their `register.d.ts`:

```typescript
declare module '@ai.assistant/contracts' {
  interface Services {
    Logger: LoggerService;
    Config: ConfigService;
  }
}
```

This keeps the foundation generic while giving consumers type-safe service resolution.

## Constraints

- Environment-agnostic: works in browsers, Node, workers, edge runtimes.
- No async in the public API. Resolution is synchronous. Only disposal is async (disposers may return promises).
- Runtime dependencies are limited to other foundations and the platform's reactive primitive.
- The contract lives in `@ai.assistant/contracts/service-container`; source implementations must satisfy it and run shared compliance tests from `@ai.assistant/tests/service-container`.
