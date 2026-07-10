/**
 * Plugin system types.
 *
 * Defines the execution engine that orchestrates plugin lifecycle hooks.
 * Plugins are plain objects with named hook implementations. The container
 * manages a set of plugins and runs hooks using caller-chosen execution
 * strategies (parallel, sequential, first, reduce, pipe).
 */
import type {Lifecycles, PluginContextOptions, PluginStore} from '..';
import type {ErrorSeverity} from '../error';
import type {EventEmitter} from '../events';
import type {Telemetry} from '../telemetry';

export type {Lifecycles, PluginContextOptions, PluginStore} from '..';

/**
 * Per-hook ordering declaration.
 *
 * Controls where a plugin's hook runs relative to other plugins for a
 * specific hook name. Ordering is per-hook, not per-plugin — a plugin
 * can run `'pre'` for one hook and `'post'` for another.
 *
 * - `'pre'` — runs before plugins at the default position.
 * - `'post'` — runs after plugins at the default position.
 *
 * Within each bucket (`pre`, default, `post`), original registration
 * order is preserved.
 */
export type HookOrder = 'pre' | 'post';

/**
 * Identifies the execution pattern for a hook invocation.
 *
 * This type is vocabulary for downstream use (e.g., hook catalog metadata).
 * Strategy selection happens through discrete methods on the container
 * (`parallel`, `first`, etc.), not via this type.
 *
 * - `'parallel'` — all handlers run concurrently, returns ignored.
 * - `'sequential'` — all handlers run in order, returns ignored.
 * - `'first'` — handlers run in order, first non-null result wins.
 * - `'reduce'` — return values from all handlers are accumulated.
 * - `'pipe'` — middleware: each handler wraps the next.
 */
export type ExecutionStrategy = 'parallel' | 'sequential' | 'first' | 'reduce' | 'pipe';

/**
 * Options returned by a cache handler to control hook result caching.
 */
export interface HookCacheOptions {
  /**
   * Cache key for this invocation.
   *
   * When omitted, a default key is derived from the hook name and
   * plugin name.
   */
  key?: string;

  /**
   * Time-to-live in milliseconds for the cached result.
   *
   * When omitted, the cached result persists for the lifetime of the
   * containing scope.
   *
   * @unit milliseconds
   */
  ttl?: number;
}

/**
 * Object form of a hook declaration.
 *
 * Allows a plugin to attach per-hook metadata — ordering, error handling,
 * caching — alongside the handler function. Plugins may provide hooks as
 * either bare functions or `HookDefinition` objects.
 *
 * @template HookMap - The hook map defining available hooks.
 * @template Name - The specific hook name within the map.
 * @template Extensions - Additional per-hook options.
 */
export type HookDefinition<
  HookMap extends Record<keyof HookMap, (...args: any[]) => any>,
  Name extends keyof HookMap,
  Extensions extends object = {},
> = {
  /** The hook handler function. */
  handler: HookMap[Name];

  /**
   * Where this hook runs relative to other plugins for this hook name.
   *
   * @defaultValue Runs at the default position (between `'pre'` and `'post'`).
   */
  order?: HookOrder;

  /**
   * Per-hook error policy callback.
   *
   * Called when the handler throws. The returned severity determines
   * whether the error is aggregated (`'recoverable'`) or causes
   * execution to halt (`'fatal'`).
   *
   * When omitted, errors are always fatal (execution halts).
   *
   * @param thrown - The value thrown by the handler.
   * @param args - The arguments that were passed to the handler.
   * @returns The severity level dictating how the error is handled.
   */
  errorHandler?(thrown: unknown, ...args: Parameters<HookMap[Name]>): ErrorSeverity;

  /**
   * Per-hook cache control callback.
   *
   * Called before the handler executes. When it returns cache options,
   * the runner may serve a cached result instead of invoking the handler.
   * When omitted, caching is disabled for this hook.
   *
   * @param args - The arguments that would be passed to the handler.
   * @returns Cache options for this invocation.
   */
  cacheHandler?(...args: Parameters<HookMap[Name]>): HookCacheOptions;

  /**
   * Opt into sequential execution within a `'parallel'` strategy.
   *
   * When `true`, the container drains the current parallel queue before
   * running this hook, then resumes parallel execution.
   *
   * Only meaningful when the hook is invoked with the `'parallel'` strategy.
   *
   * @defaultValue false
   */
  sequential?: boolean;
} & Extensions;

/**
 * Mapped type allowing each hook to be provided as either a bare
 * function or a {@link HookDefinition} object with metadata.
 *
 * @template HookMap - The hook map defining available hooks.
 */
export type PluginHooks<
  HookMap extends Record<keyof HookMap, (...args: any[]) => any> = Lifecycles,
> = {
  [Name in keyof HookMap]: HookMap[Name] | HookDefinition<HookMap, Name>;
};

/**
 * A named bundle of hook implementations.
 *
 * Plugins are plain objects with a required `name` and optional hook
 * handlers. Each hook can be provided as a bare function or as a
 * {@link HookDefinition} object carrying per-hook metadata.
 *
 * @template HookMap - The lifecycle hook map this plugin targets.
 * @template Name - The literal plugin name, used to resolve the store type.
 */
export type Plugin<
  HookMap extends Record<keyof HookMap, (...args: any[]) => any> = Lifecycles,
  Name extends string = string,
> = {
  /** Unique name identifying this plugin. */
  readonly name: Name;
} & Partial<PluginHooks<HookMap>>;

/**
 * Factory that provides scoped infrastructure for plugin contexts.
 *
 * Receives the plugin so the factory can namespace infrastructure
 * (e.g. fork telemetry with the plugin name).
 *
 * @template PluginType - The plugin type being contextualized.
 */
export interface ContextFactory<PluginType extends Plugin<any> = Plugin<any>> {
  /**
   * Produces context options for a specific plugin.
   *
   * @param plugin - The plugin requesting context options.
   * @returns The options to inject into the plugin's context.
   */
  (plugin: PluginType): PluginContextOptions;
}

/**
 * Read-only view of a plugin's execution context.
 *
 * Bound as `this` on every hook invocation (intersected with
 * `Readonly<PluginContextOptions>` at the call site). Provides access
 * to scoped infrastructure and the plugin's typed cross-hook store.
 *
 * @template PluginName - The literal plugin name, used to resolve the store type.
 */
export interface ReadonlyPluginContext<PluginName extends string = string> {
  /** The plugin name this context belongs to. */
  readonly name: PluginName;

  /**
   * Typed cross-hook state store for this plugin.
   *
   * Resolves to a partial of the shape declared in {@link PluginStore}
   * when a literal name is known, or `unknown` otherwise. The store
   * starts empty — every property requires a presence check before use.
   */
  readonly store: PluginName extends keyof PluginStore ? Partial<PluginStore[PluginName]> : unknown;

  /** The telemetry instance scoped to this plugin for instrumentation. */
  readonly telemetry: Telemetry;
}

/**
 * The full context view received as `this` in hook handlers.
 *
 * Combines the base {@link ReadonlyPluginContext} (name, store, telemetry)
 * with any infrastructure injected via {@link PluginContextOptions}
 * (e.g., container, configuration).
 *
 * @template PluginName - The literal plugin name, used to resolve the store type.
 */
export type HookContext<PluginName extends string = string> = ReadonlyPluginContext<PluginName> &
  Readonly<PluginContextOptions>;

/**
 * Full mutable plugin context used internally by the plugin engine.
 *
 * Extends {@link ReadonlyPluginContext} with lifecycle management methods.
 * Plugins never interact with this interface directly — they receive
 * the readonly view as `this`.
 *
 * @template PluginName - The literal plugin name, used to resolve the store type.
 */
export interface PluginContext<
  PluginName extends string = string,
> extends ReadonlyPluginContext<PluginName> {
  /**
   * Creates a child context with a shallow-copied store.
   *
   * When options are provided, they replace the context's infrastructure.
   * When omitted, the child inherits parent infrastructure by reference.
   *
   * @param options - Scoped infrastructure for the child context.
   * @returns A new child plugin context.
   */
  fork(options?: PluginContextOptions): PluginContext<PluginName>;

  /**
   * Freezes the context, preventing further forking.
   *
   * @returns A read-only view of this context.
   */
  freeze(): ReadonlyPluginContext<PluginName>;

  /**
   * Disposes the context and releases resources.
   *
   * After disposal, any interaction with the context throws.
   */
  dispose(): void;
}

/**
 * Options for triggering a hook on a plugin runner.
 *
 * @template HookMap - The hook map defining available hooks.
 * @template Name - The specific hook name to trigger.
 */
export interface PluginRunnerTriggerOptions<
  HookMap extends Record<keyof HookMap, (...args: any[]) => any>,
  Name extends keyof HookMap,
> {
  /** The hook name to trigger. */
  hook: Name;

  /** The arguments to pass to the hook handler. */
  args: Parameters<HookMap[Name]>;

  /** Optional context options for this invocation. */
  context?: PluginContextOptions;
}

/**
 * Read-only view of a plugin runner.
 *
 * Exposes trigger methods and inspection properties.
 *
 * @template HookMap - The hook map defining available hooks.
 */
export interface ReadonlyPluginRunner<
  HookMap extends Record<keyof HookMap, (...args: any[]) => any> = Lifecycles,
> {
  /** The plugin name this runner manages. */
  readonly name: string;

  /**
   * Triggers a hook on the managed plugin asynchronously.
   *
   * Returns `undefined` if the plugin has no handler for the hook.
   *
   * @template Name - The hook name to trigger.
   * @param options - The hook name, arguments, and optional context.
   * @returns The handler's return value, or `undefined` if no handler exists.
   */
  trigger<Name extends Extract<keyof HookMap, string>>(
    options: PluginRunnerTriggerOptions<HookMap, Name>,
  ): Promise<Awaited<ReturnType<HookMap[Name]>> | undefined>;

  /**
   * Triggers a hook on the managed plugin synchronously.
   *
   * Returns `undefined` if the plugin has no handler for the hook.
   *
   * @template Name - The hook name to trigger.
   * @param options - The hook name, arguments, and optional context.
   * @returns The handler's return value, or `undefined` if no handler exists.
   */
  triggerSync<Name extends Extract<keyof HookMap, string>>(
    options: PluginRunnerTriggerOptions<HookMap, Name>,
  ): ReturnType<HookMap[Name]> | undefined;

  /**
   * Checks whether the managed plugin has a handler for the given hook.
   *
   * @param hook - The hook name to check.
   * @returns `true` if a handler is registered.
   */
  has<Name extends Extract<keyof HookMap, string>>(hook: Name): boolean;

  /**
   * Checks whether the managed plugin has no handler for the given hook.
   *
   * @param hook - The hook name to check.
   * @returns `true` if no handler is registered.
   */
  missing<Name extends Extract<keyof HookMap, string>>(hook: Name): boolean;
}

/**
 * A plugin runner that manages a single plugin's execution.
 *
 * Wraps one plugin definition, normalizes its hooks, and provides
 * trigger methods for hook invocation. Owns the plugin's
 * {@link PluginContext} and manages its lifecycle.
 *
 * Extends {@link EventEmitter} for observability of hook execution.
 *
 * @template HookMap - The hook map defining available hooks.
 */
export interface PluginRunner<
  HookMap extends Record<keyof HookMap, (...args: any[]) => any> = Lifecycles,
>
  extends ReadonlyPluginRunner<HookMap>, EventEmitter<Record<string, any>> {
  /**
   * Creates a child runner with a forked context (store copied).
   *
   * The child runner manages the same plugin but with an isolated
   * store for scope separation.
   *
   * @returns A new child plugin runner.
   */
  fork(): PluginRunner<HookMap>;

  /**
   * Freezes the runner, preventing forking.
   *
   * Trigger methods remain available on the returned readonly view.
   *
   * @returns A read-only view of this runner.
   */
  freeze(): ReadonlyPluginRunner<HookMap>;

  /**
   * Disposes the runner and its managed context.
   *
   * After disposal, any interaction with the runner throws.
   */
  dispose(): void;
}

/**
 * Reduce callback for accumulating hook results.
 *
 * @template Accumulator - The type of the accumulated value.
 * @template Result - The awaited return type of each hook handler.
 */
export interface ReduceCallback<Accumulator, Result> {
  /**
   * Folds a handler result into the accumulator.
   *
   * @param accumulator - The current accumulated value.
   * @param result - The value returned by the hook handler.
   * @returns The updated accumulator.
   */
  (accumulator: Accumulator, result: Result): Accumulator;
}

/**
 * Options for container execution strategy methods.
 *
 * @template HookMap - The hook map defining available hooks.
 * @template Name - The specific hook name to execute.
 */
export interface PluginContainerExecuteOptions<
  HookMap extends Record<keyof HookMap, (...args: any[]) => any>,
  Name extends keyof HookMap,
> {
  /** The hook name to execute. */
  hook: Name;

  /** The arguments to pass to each handler. */
  args: Parameters<HookMap[Name]>;

  /**
   * Per-invocation context factory override.
   *
   * When provided, overrides the container's default context factory
   * for this invocation only.
   */
  context?: ContextFactory<Plugin<HookMap>>;
}

/**
 * Options for container reduce strategy methods.
 *
 * @template HookMap - The hook map defining available hooks.
 * @template Name - The specific hook name to execute.
 * @template Accumulator - The type of the accumulated result.
 */
export interface PluginContainerReduceOptions<
  HookMap extends Record<keyof HookMap, (...args: any[]) => any>,
  Name extends keyof HookMap,
  Accumulator,
> extends PluginContainerExecuteOptions<HookMap, Name> {
  /** The starting value for the accumulator. */
  initial: Accumulator;

  /** Callback that folds each result into the accumulator. */
  reduce: ReduceCallback<Accumulator, Awaited<ReturnType<HookMap[Name]>>>;
}

/**
 * Options for container synchronous reduce strategy methods.
 *
 * @template HookMap - The hook map defining available hooks.
 * @template Name - The specific hook name to execute.
 * @template Accumulator - The type of the accumulated result.
 */
export interface PluginContainerReduceSyncOptions<
  HookMap extends Record<keyof HookMap, (...args: any[]) => any>,
  Name extends keyof HookMap,
  Accumulator,
> extends PluginContainerExecuteOptions<HookMap, Name> {
  /** The starting value for the accumulator. */
  initial: Accumulator;

  /** Callback that folds each result into the accumulator. */
  reduce: ReduceCallback<Accumulator, ReturnType<HookMap[Name]>>;
}

/**
 * Options for constructing a {@link PluginContainer}.
 *
 * @template HookMap - The hook map defining available hooks.
 */
export interface PluginContainerOptions<
  HookMap extends Record<keyof HookMap, (...args: any[]) => any> = Lifecycles,
> {
  /**
   * Default context factory for producing per-plugin infrastructure.
   *
   * Used when strategy methods do not provide their own per-invocation
   * factory. The per-invocation factory overrides this default.
   */
  contextFactory?: ContextFactory<Plugin<HookMap>>;

  /**
   * Initial plugins to register in the container at construction time.
   */
  plugins?: Plugin<HookMap>[];
}

/**
 * Options for forking a {@link PluginContainer}.
 *
 * @template HookMap - The hook map defining available hooks.
 */
export interface PluginContainerForkOptions<
  HookMap extends Record<keyof HookMap, (...args: any[]) => any> = Lifecycles,
> {
  /**
   * Context factory for the child container.
   *
   * When omitted, the child inherits the parent's context factory.
   */
  contextFactory?: ContextFactory<Plugin<HookMap>>;

  /**
   * Additional plugins for the child scope beyond those inherited
   * from the parent.
   */
  plugins?: Plugin<HookMap>[];

  /**
   * Telemetry instance for the child container.
   *
   * When omitted, the child inherits the parent's telemetry instance.
   */
  telemetry?: Telemetry;
}

/**
 * Read-only view of a plugin container.
 *
 * Exposes hook execution strategies and inspection methods.
 *
 * @template HookMap - The hook map defining available hooks.
 */
export interface ReadonlyPluginContainer<
  HookMap extends Record<keyof HookMap, (...args: any[]) => any> = Lifecycles,
> {
  /**
   * Runs all handlers for a hook concurrently. Return values are ignored.
   *
   * Handlers that declare `sequential: true` in their hook definition
   * drain the parallel queue before running, then resume parallel execution.
   *
   * @template Name - The hook name to execute.
   * @param options - Execution options.
   * @returns A promise that resolves when all handlers complete.
   */
  parallel<Name extends Extract<keyof HookMap, string>>(
    options: PluginContainerExecuteOptions<HookMap, Name>,
  ): Promise<void>;

  /**
   * Runs all handlers for a hook in registration order. Return values are ignored.
   *
   * Each handler is awaited before the next one starts.
   *
   * @template Name - The hook name to execute.
   * @param options - Execution options.
   * @returns A promise that resolves when all handlers complete.
   */
  sequential<Name extends Extract<keyof HookMap, string>>(
    options: PluginContainerExecuteOptions<HookMap, Name>,
  ): Promise<void>;

  /**
   * Runs handlers in order until one returns a non-null value.
   *
   * Remaining handlers are skipped once a result is found.
   *
   * @template Name - The hook name to execute.
   * @param options - Execution options.
   * @returns The first non-null result, or `undefined`.
   */
  first<Name extends Extract<keyof HookMap, string>>(
    options: PluginContainerExecuteOptions<HookMap, Name>,
  ): Promise<Awaited<ReturnType<HookMap[Name]>> | undefined>;

  /**
   * Runs all handlers and accumulates their results into a single value.
   *
   * @template Name - The hook name to execute.
   * @template Accumulator - The type of the accumulated result.
   * @param options - Execution and reduce options.
   * @returns The final accumulated value.
   */
  reduce<Name extends Extract<keyof HookMap, string>, Accumulator>(
    options: PluginContainerReduceOptions<HookMap, Name, Accumulator>,
  ): Promise<Accumulator>;

  /**
   * Runs handlers as middleware with `next()` semantics.
   *
   * Each handler wraps the next, enabling before/after logic.
   * The final result is returned.
   *
   * @template Name - The hook name to execute.
   * @param options - Execution options.
   * @returns The result of the middleware chain.
   */
  pipe<Name extends Extract<keyof HookMap, string>>(
    options: PluginContainerExecuteOptions<HookMap, Name>,
  ): Promise<Awaited<ReturnType<HookMap[Name]>>>;

  /**
   * Synchronous variant of {@link sequential}.
   *
   * @template Name - The hook name to execute.
   * @param options - Execution options.
   */
  sequentialSync<Name extends Extract<keyof HookMap, string>>(
    options: PluginContainerExecuteOptions<HookMap, Name>,
  ): void;

  /**
   * Synchronous variant of {@link first}.
   *
   * @template Name - The hook name to execute.
   * @param options - Execution options.
   * @returns The first non-null result, or `undefined`.
   */
  firstSync<Name extends Extract<keyof HookMap, string>>(
    options: PluginContainerExecuteOptions<HookMap, Name>,
  ): ReturnType<HookMap[Name]> | undefined;

  /**
   * Synchronous variant of {@link reduce}.
   *
   * @template Name - The hook name to execute.
   * @template Accumulator - The type of the accumulated result.
   * @param options - Execution and reduce options.
   * @returns The final accumulated value.
   */
  reduceSync<Name extends Extract<keyof HookMap, string>, Accumulator>(
    options: PluginContainerReduceSyncOptions<HookMap, Name, Accumulator>,
  ): Accumulator;

  /**
   * Synchronous variant of {@link pipe}.
   *
   * @template Name - The hook name to execute.
   * @param options - Execution options.
   * @returns The result of the middleware chain.
   */
  pipeSync<Name extends Extract<keyof HookMap, string>>(
    options: PluginContainerExecuteOptions<HookMap, Name>,
  ): ReturnType<HookMap[Name]>;

  /**
   * Composes a value by threading it through all handlers for a hook.
   *
   * Each handler receives the accumulated value as `children` in its
   * first argument and returns a new value that wraps or replaces it.
   * A handler may return null or undefined to intentionally gate the
   * composed value.
   *
   * Execution is synchronous and follows registration order within
   * ordering buckets (pre → normal → post).
   *
   * @template Name - The hook name to execute.
   * @param options - Execution options. The initial value is taken from
   *   `args[0].children`.
   * @returns The final composed value after all handlers have wrapped it.
   */
  renderable<Name extends Extract<keyof HookMap, string>>(
    options: PluginContainerExecuteOptions<HookMap, Name>,
  ): ReturnType<HookMap[Name]>;

  /**
   * Checks whether any plugin has a handler for the given hook.
   *
   * @param hook - The hook name to check.
   * @returns `true` if at least one handler is registered.
   */
  has<Name extends Extract<keyof HookMap, string>>(hook: Name): boolean;

  /**
   * Checks whether no plugin has a handler for the given hook.
   *
   * @param hook - The hook name to check.
   * @returns `true` if no handler is registered.
   */
  missing<Name extends Extract<keyof HookMap, string>>(hook: Name): boolean;

  /** The total number of registered plugins. */
  readonly size: number;
}

/**
 * A plugin container that orchestrates hook execution across plugins.
 *
 * The container manages a set of {@link PluginRunner} instances and
 * provides execution strategies for invoking hooks. It is agnostic to
 * specific hook names — the caller decides which strategy to use.
 *
 * Extends {@link EventEmitter} for wiring into the framework's event tree.
 *
 * @template HookMap - The hook map defining available hooks.
 */
export interface PluginContainer<
  HookMap extends Record<keyof HookMap, (...args: any[]) => any> = Lifecycles,
>
  extends ReadonlyPluginContainer<HookMap>, EventEmitter<Record<string, any>> {
  /**
   * Adds a plugin to this container.
   *
   * @param plugin - The plugin to register.
   * @returns `this` for fluent chaining.
   */
  add(plugin: Plugin<HookMap>): this;

  /**
   * Removes a previously registered plugin.
   *
   * @param plugin - The plugin to remove.
   * @returns `this` for fluent chaining.
   */
  remove(plugin: Plugin<HookMap>): this;

  /**
   * Creates a child container inheriting this container's plugins.
   *
   * The child forks each existing runner (stores copied for isolation)
   * and adds new runners for any additional plugins provided.
   *
   * @param options - Fork options including the context factory.
   * @returns A new child plugin container.
   */
  fork(options?: PluginContainerForkOptions<HookMap>): PluginContainer<HookMap>;

  /**
   * Freezes the container, preventing plugin addition and removal.
   *
   * Execution strategies remain available on the returned readonly view.
   *
   * @returns A read-only view of this container.
   */
  freeze(): ReadonlyPluginContainer<HookMap>;

  /**
   * Disposes the container and all managed runners.
   *
   * After disposal, any interaction with the container throws.
   */
  dispose(): void;
}
