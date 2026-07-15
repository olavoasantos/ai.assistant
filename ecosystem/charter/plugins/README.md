# Charter — @ai.assistant/plugins

## Purpose

A plugin execution engine that takes plain plugin objects and orchestrates their lifecycle hooks. Any subsystem that needs extensibility via plugins uses this single mechanism. Plugins declare named hooks, the engine normalizes them, and callers choose execution strategies (parallel, sequential, first, reduce, pipe) to invoke hooks across a managed set of plugins.

## What It Is

- The single plugin orchestration mechanism for all framework and application code.
- A strategy-based execution system: the caller chooses how hooks are invoked (parallel, sequential, first, reduce, pipe) via method name.
- A per-plugin context system: each plugin receives a persistent, scoped view of the world with cross-hook mutable state.
- A fork-and-isolate system: containers and runners can be forked for scope isolation with inherited but independent state.
- An observable system: both runners and containers extend `EventEmitter` for lifecycle and error observability.

## What It Is Not

- Not a plugin loader or discovery system. It receives already-constructed plugin objects. Resolution, import, and configuration are the caller's responsibility.
- Not a dependency resolver. Plugins do not declare dependencies on other plugins. Ordering is explicit via hook metadata.
- Not async internally. Strategy methods like `parallel` use `Promise.all` but the engine machinery (normalization, ordering, context binding) is synchronous.
- Not domain-aware. It knows nothing about users, products, or any specific domain. Hook names and plugin shapes are declared via module augmentation by consuming packages.

## Entities

### PluginContext

A persistent, per-plugin scoped view of the world. Created once per plugin runner and passed as `this` to every hook invocation.

- `name` — the plugin's identifier string.
- `store` — a mutable object for cross-hook state that persists between invocations within a plugin.
- Additional values from `PluginContextOptions` — empty at the framework level, extended by applications via declaration merging.

### PluginRunner

Wraps a single plugin definition and owns its PluginContext. The unit of execution for one plugin.

- Normalizes hooks from the raw plugin object (bare function → object form with metadata).
- Triggers individual hooks with context binding, error handling, and optional caching.
- Extends `EventEmitter` for per-plugin observability.

### PluginContainer

The orchestration engine. Manages a set of PluginRunners and exposes strategy methods for invoking hooks across all registered plugins.

- Accepts initial plugins via constructor options or via `add()` after construction.
- Strategy methods (parallel, sequential, first, reduce, pipe + sync variants) use an options-object API.
- Manages runner lifecycle (add, remove, fork, freeze, dispose).
- Extends `EventEmitter` for event bubbling from child runners.

## Invariants

### Identity

- `PluginRunner` instances are identified by a `Symbol.for('ai.assistant:PluginRunner')` brand.
- `PluginContainer` instances are identified by a `Symbol.for('ai.assistant:PluginContainer')` brand.
- Identity checks never use `instanceof`. Guards use symbol presence via validation rules, surviving multiple package versions, bundler deduplication failures, and realm crossings.
- Brand identity is trust-based: objects without the brand symbol are rejected, but any code that knows the brand key string can forge acceptance. This is the deliberate `Symbol.for()` trade-off shared across all foundation modules.

### Plugin Shape

- A plugin is a plain object with a `name` string property and optional hook implementations.
- Hook implementations may be bare functions or objects with metadata (ordering, error handling, caching configuration).
- Plugins carry no framework base class, no required lifecycle methods, no registration ceremony beyond being passed to the container.

### Hook Normalization

- A bare function attached to a hook name is normalized into object form with default metadata.
- Default ordering is the default position (between `pre` and `post`). Default error handling has no handler (meaning errors are fatal). Default caching is disabled.
- Normalization happens once at runner construction time, not on every invocation.

### Ordering Semantics

- Hook metadata declares an ordering bucket: `pre`, default, or `post`.
- Within each bucket, plugins execute in registration order (the order they were added to the container).
- The full execution order is: all `pre` handlers → all default handlers → all `post` handlers.
- Ordering is resolved per strategy invocation, not globally cached — adding/removing plugins affects subsequent invocations.

### Context as `this`

- All hook handlers receive `this` bound to a readonly view of the plugin's context.
- The context properties (`name`, `store` reference, option values) are not reassignable from within the handler.
- The `store` object itself is mutable — handlers may read and write properties on it.
- The readonly view prevents handlers from calling context lifecycle methods (fork, freeze, dispose).

### Error Model

- If a hook handler throws and no error handler is configured for that hook, the error is fatal — it halts execution of remaining handlers in the current strategy invocation.
- If an error handler is configured, it receives the error and returns an `ErrorSeverity`: `'recoverable'` or `'fatal'`.
- `'recoverable'` — the error is emitted as a `plugin:hook.errored` event and swallowed. The trigger returns `undefined`. Execution continues with the next handler.
- `'fatal'` — execution halts immediately. The error is re-thrown with `severity: 'fatal'` metadata. Remaining handlers are skipped.
- Error handling is fully owned by the PluginRunner. The container does not apply additional error policy — it simply lets fatal throws propagate.

### Caching

- Caching is per-hook, opt-in via hook metadata.
- When configured, the cache handler produces a cache key and TTL for each invocation based on the hook arguments.
- If a cached result exists and has not expired, the handler is skipped and the cached result is returned.
- Caching is bypassed entirely for the `pipe` strategy (each handler must process the piped value).
- Cache invalidation happens on TTL expiry. There is no manual invalidation API.

### Strategy Methods

- `parallel(options)` — invokes all matching handlers concurrently via `Promise.all`. Return values are ignored.
- `sequential(options)` — invokes handlers one at a time in order. Return values are ignored.
- `first(options)` — invokes handlers in order, returns the first non-null/undefined result. Remaining handlers are skipped.
- `reduce(options)` — invokes handlers in order, folding each result into an accumulator via a caller-provided callback.
- `pipe(options)` — invokes handlers as middleware with `next()` semantics, enabling before/after logic. The first argument MUST be an object — `next` is injected into it as a property. Hooks with primitive first arguments cannot use the pipe strategy.
- `renderable(options)` — composes a value by threading `args[0].children` through all matching handlers. Each handler receives the accumulated value as `children` in its first argument and returns a new value that replaces it. A handler may return null or undefined to intentionally gate the composed value. Synchronous only — no async variant. Follows standard ordering (pre → default → post). Used for composing renderable layers (context providers, error boundaries) around a base value.
- Sync variants (`sequentialSync`, `firstSync`, `reduceSync`, `pipeSync`) exist for synchronous execution contexts.
- There is no `parallelSync` — concurrent synchronous execution is a contradiction.
- All strategy methods accept an options object with `hook`, `args`, and optional overrides.

### Context Factory

- The container accepts a default `contextFactory` at construction time. This factory produces the `PluginContextOptions` values for each plugin's context.
- Strategy methods can override the context factory per-invocation via the options object.
- When no factory is provided (construction or invocation), contexts receive only the base properties (`name`, `store`).
- The factory is called when producing context options for a runner — at runner construction time and when a per-invocation override is provided.
- The runner's `trigger()` method also accepts per-invocation `context` options, allowing the caller to override infrastructure for a specific hook call.

### Fork Semantics

- `PluginContext.fork()` creates a child context with a shallow-copied store. Mutations to the child's store do not affect the parent. Mutations to nested objects within the store are shared (shallow copy, not deep).
- `PluginRunner.fork()` creates a new runner with a forked context. The plugin definition is shared (not copied). The forked runner has independent state.
- `PluginContainer.fork(options?)` creates a child container. Existing runners are forked (independent state). Additional plugins provided via `options.plugins` get new runners. The parent's `contextFactory` is inherited unless overridden in fork options. A child-specific `telemetry` instance can be provided via fork options.
- Forked instances are fully independent after creation — no ongoing synchronization with the parent.

### Freeze Behavior

- `freeze()` on a container prevents `add()` and `remove()` from modifying the plugin set. Attempts throw.
- Strategy execution methods remain available on a frozen container — freezing locks membership, not execution.
- `freeze()` on a context prevents mutations to the context itself. The store remains mutable (it is the plugin's working memory).
- Freeze is one-way. There is no unfreeze.

### Dispose Behavior

- `dispose()` is terminal. After disposal, all public methods except readonly accessors throw.
- The disposed flag is set BEFORE emitting the terminal event and before cleanup. This prevents reentrancy — listeners triggered by the disposal event cannot call methods on the disposing instance.
- Container dispose order: set disposed flag → emit event → detach and dispose all runners → clear runner set → clear caches.
- Runner dispose order: set disposed flag → dispose context → clear cache.
- Context dispose order: clear store → set disposed flag.
- Calling `dispose()` on an already-disposed instance throws.

### Container Uses Runners Internally

- The container never interacts with raw plugin objects after initial runner construction.
- All hook invocation, error handling, caching, and context binding flows through PluginRunner.
- Strategy methods iterate over runners, calling `trigger()` or `triggerSync()` on each.

## Extensibility

### Lifecycles Interface

The `Lifecycles` interface in `@ai.assistant/contracts` is empty by default. Consuming packages extend it via module augmentation to declare available hook names and their signatures:

```typescript
declare module '@ai.assistant/contracts' {
  interface Lifecycles {
    boot(config: BootConfig): MaybeAsync<void>;
    transform(code: string, id: string): string | undefined;
  }
}
```

### PluginContextOptions

The `PluginContextOptions` interface is empty at the framework level. Applications extend it via declaration merging to inject additional context values:

```typescript
declare module '@ai.assistant/contracts' {
  interface PluginContextOptions {
    logger: Logger;
    config: AppConfig;
  }
}
```

### PluginStore

The `PluginStore` interface is extensible via declaration merging for type-safe per-plugin state. The key is the plugin's name:

```typescript
declare module '@ai.assistant/contracts' {
  interface PluginStore {
    'my-plugin': {
      transformCache: Map<string, string>;
      hitCount: number;
    };
  }
}
```

## Constraints

- Zero external runtime dependencies beyond other foundations (`@ai.assistant/error`, `@ai.assistant/event-emitter`, `@ai.assistant/helpers`, `@ai.assistant/telemetry`, `@ai.assistant/validation`).
- Environment-agnostic: works in browsers, Node, workers, edge runtimes.
- The contract lives in `@ai.assistant/contracts/plugins`. This module implements it. The TypeScript compiler enforces alignment.
- Not domain-aware. The engine has no knowledge of users, products, or any specific domain. Hook names and plugin shapes are domain concerns declared via augmentation.
- Not async internally. The engine machinery (normalization, ordering, context binding, error aggregation) is synchronous. Async strategies (`parallel`, `sequential`, `first`, `reduce`, `pipe`) await handler results but the orchestration logic itself is sync.
