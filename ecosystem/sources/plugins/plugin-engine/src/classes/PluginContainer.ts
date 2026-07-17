import type * as Contracts from '@ai.assistant/contracts/plugins';
import type {Telemetry} from '@ai.assistant/contracts/telemetry';
import {ApplicationError} from '@ai.assistant/error';
import {EventEmitter} from '@ai.assistant/event-emitter';
import {
  PLUGIN_CONTAINER_CONTEXT_FACTORY,
  PLUGIN_CONTAINER_DEFERRED_RUNNERS,
  PLUGIN_CONTAINER_DIRECT_SCOPES,
  PLUGIN_CONTAINER_DISPOSED,
  PLUGIN_CONTAINER_FROZEN,
  PLUGIN_CONTAINER_IDENTIFIER,
  PLUGIN_CONTAINER_PROTECTED,
  PLUGIN_CONTAINER_RUNNERS,
  PLUGIN_CONTAINER_SORTED,
} from '../constants';
import type {PluginContainerEvents, PreparedRunnerEntry, SortedRunnerEntry} from '../types';
import {PluginDirectExecutor} from './PluginDirectExecutor';
import {PluginRunner} from './PluginRunner';

/**
 * Options for constructing a {@link PluginContainer}.
 */
export interface PluginContainerConstructorOptions<
  HookMap extends Record<keyof HookMap, (...args: any[]) => any> = Contracts.Lifecycles,
> extends Contracts.PluginContainerOptions<HookMap> {
  /** Telemetry client for measuring strategy execution. */
  telemetry: Telemetry;
}

/**
 * A plugin container that orchestrates hook execution across plugins.
 *
 * The container manages a set of {@link PluginRunner} instances and
 * provides execution strategies for invoking hooks. It is agnostic to
 * specific hook names — the caller decides which strategy to use.
 *
 * Error handling is delegated to each runner. Recoverable errors are
 * swallowed by the runner (emitted as events). Fatal errors propagate
 * as throws and halt strategy execution.
 *
 * @template HookMap - The hook map defining available hooks.
 */
export class PluginContainer<
  HookMap extends Record<keyof HookMap, (...args: any[]) => any> = Contracts.Lifecycles,
>
  extends EventEmitter<PluginContainerEvents>
  implements Contracts.PluginContainer<HookMap>
{
  /** Symbol brand for cross-boundary identity checks. */
  readonly [PLUGIN_CONTAINER_IDENTIFIER] = true as const;

  /** @internal Ordered list of plugin runners. */
  [PLUGIN_CONTAINER_RUNNERS]: PluginRunner<HookMap>[] = [];

  /** @internal Default context factory. */
  [PLUGIN_CONTAINER_CONTEXT_FACTORY]:
    | Contracts.ContextFactory<Contracts.Plugin<HookMap>>
    | undefined;

  /** @internal Memoized sorted entries per hook name. */
  [PLUGIN_CONTAINER_SORTED]: Map<string, SortedRunnerEntry[]> = new Map();

  /** @internal Plugin objects protected from removal. */
  [PLUGIN_CONTAINER_PROTECTED]: Set<Contracts.Plugin<HookMap>> = new Set();

  /** @internal Number of active bounded direct scopes. */
  [PLUGIN_CONTAINER_DIRECT_SCOPES] = 0;

  /** @internal Removed runners retained until active direct scopes finish. */
  [PLUGIN_CONTAINER_DEFERRED_RUNNERS]: Set<PluginRunner<HookMap>> = new Set();

  /** @internal */
  [PLUGIN_CONTAINER_FROZEN] = false;

  /** @internal */
  [PLUGIN_CONTAINER_DISPOSED] = false;

  /** @internal Telemetry client for measuring strategy execution. */
  private telemetry: Telemetry;

  /**
   * Creates a new plugin container.
   *
   * @param options - Construction options.
   */
  constructor(options: PluginContainerConstructorOptions<HookMap>) {
    super();
    this[PLUGIN_CONTAINER_CONTEXT_FACTORY] = options.contextFactory;
    this.telemetry = options.telemetry;

    if (options.plugins != null) {
      for (const plugin of options.plugins) {
        this.add(plugin);
      }
    }
  }

  /** The total number of registered plugins. */
  get size(): number {
    return this[PLUGIN_CONTAINER_RUNNERS].length;
  }

  /**
   * Adds a plugin to this container.
   *
   * @param plugin - The plugin to register.
   * @returns `this` for fluent chaining.
   */
  add(plugin: Contracts.Plugin<HookMap>): this {
    this.ensureWritable();
    const contextOptions = this[PLUGIN_CONTAINER_CONTEXT_FACTORY]?.(plugin);
    const runnerTelemetry = this.telemetry.fork(plugin.name);
    const runner = new PluginRunner(plugin, {
      telemetry: runnerTelemetry,
      context: contextOptions,
    });
    this[PLUGIN_CONTAINER_RUNNERS].push(runner);
    this[PLUGIN_CONTAINER_SORTED].clear();
    this.addChild(runner);
    this.emit('plugin:added', {details: {plugin: plugin.name}});
    return this;
  }

  /**
   * Removes a previously registered plugin.
   *
   * @param plugin - The plugin to remove.
   * @returns `this` for fluent chaining.
   */
  remove(plugin: Contracts.Plugin<HookMap>): this {
    this.ensureWritable();
    if (this[PLUGIN_CONTAINER_PROTECTED].has(plugin)) {
      throw new ApplicationError({
        message: `Cannot remove protected plugin "${plugin.name}".`,
        code: 500,
      });
    }

    const index = this[PLUGIN_CONTAINER_RUNNERS].findIndex(
      (runner) => runner.getPlugin() === plugin,
    );
    if (index !== -1) {
      const runner = this[PLUGIN_CONTAINER_RUNNERS][index];
      this[PLUGIN_CONTAINER_RUNNERS].splice(index, 1);
      this[PLUGIN_CONTAINER_SORTED].clear();
      this.removeChild(runner);
      if (this[PLUGIN_CONTAINER_DIRECT_SCOPES] > 0) {
        this[PLUGIN_CONTAINER_DEFERRED_RUNNERS].add(runner);
      } else {
        runner.dispose();
      }
      this.emit('plugin:removed', {details: {plugin: plugin.name}});
    }
    return this;
  }

  /**
   * Permanently protects every registration of a plugin from removal.
   *
   * @param plugin - The registered plugin to protect.
   * @returns `this` for fluent chaining.
   */
  protect(plugin: Contracts.Plugin<HookMap>): this {
    this.ensureWritable();
    const registered = this[PLUGIN_CONTAINER_RUNNERS].some(
      (runner) => runner.getPlugin() === plugin,
    );
    if (!registered) {
      throw new ApplicationError({
        message: `Cannot protect unregistered plugin "${plugin.name}".`,
        code: 500,
      });
    }

    if (!this[PLUGIN_CONTAINER_PROTECTED].has(plugin)) {
      this[PLUGIN_CONTAINER_PROTECTED].add(plugin);
      this.emit('plugin:protected', {details: {plugin: plugin.name}});
    }
    return this;
  }

  /**
   * Checks whether any plugin has a handler for the given hook.
   */
  has<Name extends Extract<keyof HookMap, string>>(hook: Name): boolean {
    this.ensureNotDisposed();
    return this[PLUGIN_CONTAINER_RUNNERS].some((runner) => runner.has(hook));
  }

  /**
   * Checks whether no plugin has a handler for the given hook.
   */
  missing<Name extends Extract<keyof HookMap, string>>(hook: Name): boolean {
    return !this.has(hook);
  }

  /**
   * Runs all handlers for a hook concurrently. Return values are ignored.
   * Fatal errors from any handler halt execution after the current batch settles.
   */
  async parallel<Name extends Extract<keyof HookMap, string>>(
    options: Contracts.PluginContainerExecuteOptions<HookMap, Name>,
  ): Promise<void> {
    this.ensureNotDisposed();
    const entries = this.getSortedEntries(options.hook);
    if (entries.length === 0) return;

    const contextFactory = options.context ?? this[PLUGIN_CONTAINER_CONTEXT_FACTORY];
    const hookName = options.hook;

    await this.telemetry.measureCallback(
      hookName,
      async () => {
        const parallelPromises: Array<Promise<void>> = [];
        let fatalError: unknown;

        for (const entry of entries) {
          if (fatalError != null) break;

          const contextOptions = contextFactory?.(entry.plugin);

          if (entry.hook.sequential) {
            await this.drainParallel(parallelPromises, (err) => {
              fatalError = err;
            });
            if (fatalError != null) break;
            await entry.runner.trigger({
              hook: options.hook,
              args: options.args,
              context: contextOptions,
            });
          } else {
            parallelPromises.push(
              entry.runner
                .trigger({hook: options.hook, args: options.args, context: contextOptions})
                .then(() => undefined)
                .catch((thrown: unknown) => {
                  fatalError = thrown;
                }),
            );
          }
        }

        await this.drainParallel(parallelPromises, (err) => {
          fatalError = err;
        });

        if (fatalError != null) throw fatalError;
      },
      {tags: {strategy: 'parallel'}},
    );
  }

  /**
   * Runs all handlers for a hook in registration order. Return values are ignored.
   * Fatal errors halt remaining handlers.
   */
  async sequential<Name extends Extract<keyof HookMap, string>>(
    options: Contracts.PluginContainerExecuteOptions<HookMap, Name>,
  ): Promise<void> {
    this.ensureNotDisposed();
    const entries = this.getSortedEntries(options.hook);
    if (entries.length === 0) return;

    const contextFactory = options.context ?? this[PLUGIN_CONTAINER_CONTEXT_FACTORY];
    const hookName = options.hook;

    await this.telemetry.measureCallback(
      hookName,
      async () => {
        for (const entry of entries) {
          const contextOptions = contextFactory?.(entry.plugin);
          await entry.runner.trigger({
            hook: options.hook,
            args: options.args,
            context: contextOptions,
          });
        }
      },
      {tags: {strategy: 'sequential'}},
    );
  }

  /**
   * Runs handlers in order until one returns a non-null value.
   */
  async first<Name extends Extract<keyof HookMap, string>>(
    options: Contracts.PluginContainerExecuteOptions<HookMap, Name>,
  ): Promise<Awaited<ReturnType<HookMap[Name]>> | undefined> {
    this.ensureNotDisposed();
    const entries = this.getSortedEntries(options.hook);
    if (entries.length === 0) return undefined;

    const contextFactory = options.context ?? this[PLUGIN_CONTAINER_CONTEXT_FACTORY];
    const hookName = options.hook;

    return this.telemetry.measureCallback(
      hookName,
      async () => {
        for (const entry of entries) {
          const contextOptions = contextFactory?.(entry.plugin);
          const result = await entry.runner.trigger({
            hook: options.hook,
            args: options.args,
            context: contextOptions,
          });
          if (result != null) return result;
        }
        return undefined;
      },
      {tags: {strategy: 'first'}},
    );
  }

  /**
   * Runs all handlers and accumulates their results into a single value.
   */
  async reduce<Name extends Extract<keyof HookMap, string>, Accumulator>(
    options: Contracts.PluginContainerReduceOptions<HookMap, Name, Accumulator>,
  ): Promise<Accumulator> {
    this.ensureNotDisposed();
    const entries = this.getSortedEntries(options.hook);
    if (entries.length === 0) return options.initial;

    const contextFactory = options.context ?? this[PLUGIN_CONTAINER_CONTEXT_FACTORY];
    const hookName = options.hook;

    return this.telemetry.measureCallback(
      hookName,
      async () => {
        let accumulator = options.initial;
        for (const entry of entries) {
          const contextOptions = contextFactory?.(entry.plugin);
          const result = await entry.runner.trigger({
            hook: options.hook,
            args: options.args,
            context: contextOptions,
          });
          if (result !== undefined) {
            accumulator = options.reduce(accumulator, result);
          }
        }
        return accumulator;
      },
      {tags: {strategy: 'reduce'}},
    );
  }

  /**
   * Runs handlers as middleware with `next()` semantics.
   * Cache is bypassed for pipe (each handler depends on downstream).
   */
  async pipe<Name extends Extract<keyof HookMap, string>>(
    options: Contracts.PluginContainerPipeOptions<HookMap, Name>,
  ): Promise<Awaited<ReturnType<HookMap[Name]>>> {
    this.ensureNotDisposed();
    const firstArgument = options.args[0] as unknown;
    if (firstArgument == null || typeof firstArgument !== 'object') {
      throw new ApplicationError({
        message: 'Plugin pipe execution requires an object as its first hook argument.',
        code: 500,
      });
    }
    const entries = this.getSortedEntries(options.hook);
    const contextFactory = options.context ?? this[PLUGIN_CONTAINER_CONTEXT_FACTORY];
    const hookName = options.hook;

    return this.telemetry.measureCallback(
      hookName,
      async () => {
        const dispatch = async (index: number): Promise<any> => {
          const entry = entries[index];
          if (entry == null) return options.terminal?.(...options.args);

          const contextOptions = contextFactory?.(entry.plugin);
          const prepared = entry.runner.prepareInvocation(hookName, contextOptions);
          if (prepared == null) return dispatch(index + 1);

          let nextCalled = false;
          let nextResult: Promise<any> | undefined;
          let continuationError: ApplicationError | undefined;
          const next = (): Promise<any> => {
            if (nextCalled) {
              continuationError = new ApplicationError({
                message: `Plugin middleware continuation for "${hookName}" was called more than once.`,
                code: 500,
              });
              throw continuationError;
            }
            nextCalled = true;
            nextResult = dispatch(index + 1);
            return nextResult;
          };
          const argsWithNext = [
            {...(options.args[0] as object), next},
            ...options.args.slice(1),
          ] as Parameters<HookMap[Name]>;
          const result = await entry.runner.invokePrepared(prepared, argsWithNext, {cache: false});
          if (continuationError != null) throw continuationError;
          if (!result.recovered) return result.value;
          return nextCalled ? nextResult : dispatch(index + 1);
        };

        return await dispatch(0);
      },
      {tags: {strategy: 'pipe'}},
    );
  }

  /**
   * Runs observers in order while containing fatal observer failures.
   */
  async observe<Name extends Extract<keyof HookMap, string>>(
    options: Contracts.PluginContainerExecuteOptions<HookMap, Name>,
  ): Promise<void> {
    this.ensureNotDisposed();
    const entries = this.getSortedEntries(options.hook);
    if (entries.length === 0) return;

    const contextFactory = options.context ?? this[PLUGIN_CONTAINER_CONTEXT_FACTORY];
    try {
      await this.telemetry.measureCallback(
        options.hook,
        async () => {
          for (const entry of entries) {
            const contextOptions = contextFactory?.(entry.plugin);
            await entry.runner.trigger({
              hook: options.hook,
              args: options.args,
              context: contextOptions,
            });
          }
        },
        {tags: {strategy: 'observe'}},
      );
    } catch (thrown) {
      try {
        this.emit('plugin:observation.errored', {
          details: {hook: options.hook, error: thrown},
        });
      } catch {
        // Observation diagnostics are contained with the observer pipeline.
      }
    }
  }

  /**
   * Synchronous variant of {@link sequential}.
   */
  sequentialSync<Name extends Extract<keyof HookMap, string>>(
    options: Contracts.PluginContainerExecuteOptions<HookMap, Name>,
  ): void {
    this.ensureNotDisposed();
    const entries = this.getSortedEntries(options.hook);
    if (entries.length === 0) return;

    const contextFactory = options.context ?? this[PLUGIN_CONTAINER_CONTEXT_FACTORY];
    const hookName = options.hook;

    this.telemetry.measureCallback(
      hookName,
      () => {
        for (const entry of entries) {
          const contextOptions = contextFactory?.(entry.plugin);
          entry.runner.triggerSync({
            hook: options.hook,
            args: options.args,
            context: contextOptions,
          });
        }
      },
      {tags: {strategy: 'sequential'}},
    );
  }

  /**
   * Synchronous variant of {@link first}.
   */
  firstSync<Name extends Extract<keyof HookMap, string>>(
    options: Contracts.PluginContainerExecuteOptions<HookMap, Name>,
  ): ReturnType<HookMap[Name]> | undefined {
    this.ensureNotDisposed();
    const entries = this.getSortedEntries(options.hook);
    if (entries.length === 0) return undefined;

    const contextFactory = options.context ?? this[PLUGIN_CONTAINER_CONTEXT_FACTORY];
    const hookName = options.hook;

    return this.telemetry.measureCallback(
      hookName,
      () => {
        for (const entry of entries) {
          const contextOptions = contextFactory?.(entry.plugin);
          const result = entry.runner.triggerSync({
            hook: options.hook,
            args: options.args,
            context: contextOptions,
          });
          if (result != null) return result;
        }
        return undefined;
      },
      {tags: {strategy: 'first'}},
    );
  }

  /**
   * Synchronous variant of {@link reduce}.
   */
  reduceSync<Name extends Extract<keyof HookMap, string>, Accumulator>(
    options: Contracts.PluginContainerReduceSyncOptions<HookMap, Name, Accumulator>,
  ): Accumulator {
    this.ensureNotDisposed();
    const entries = this.getSortedEntries(options.hook);
    if (entries.length === 0) return options.initial;

    const contextFactory = options.context ?? this[PLUGIN_CONTAINER_CONTEXT_FACTORY];
    const hookName = options.hook;

    return this.telemetry.measureCallback(
      hookName,
      () => {
        let accumulator = options.initial;
        for (const entry of entries) {
          const contextOptions = contextFactory?.(entry.plugin);
          const result = entry.runner.triggerSync({
            hook: options.hook,
            args: options.args,
            context: contextOptions,
          });
          if (result !== undefined) {
            accumulator = options.reduce(accumulator, result);
          }
        }
        return accumulator;
      },
      {tags: {strategy: 'reduce'}},
    );
  }

  /**
   * Synchronous variant of {@link pipe}.
   */
  pipeSync<Name extends Extract<keyof HookMap, string>>(
    options: Contracts.PluginContainerPipeOptions<HookMap, Name>,
  ): ReturnType<HookMap[Name]> {
    this.ensureNotDisposed();
    const firstArgument = options.args[0] as unknown;
    if (firstArgument == null || typeof firstArgument !== 'object') {
      throw new ApplicationError({
        message: 'Plugin pipe execution requires an object as its first hook argument.',
        code: 500,
      });
    }
    const entries = this.getSortedEntries(options.hook);
    const contextFactory = options.context ?? this[PLUGIN_CONTAINER_CONTEXT_FACTORY];
    const hookName = options.hook;

    return this.telemetry.measureCallback(
      hookName,
      () => {
        const dispatch = (index: number): any => {
          const entry = entries[index];
          if (entry == null) return options.terminal?.(...options.args);

          const contextOptions = contextFactory?.(entry.plugin);
          const prepared = entry.runner.prepareInvocation(hookName, contextOptions);
          if (prepared == null) return dispatch(index + 1);

          let nextCalled = false;
          let nextResult: any;
          let nextError: unknown;
          let nextThrew = false;
          let continuationError: ApplicationError | undefined;
          const next = (): any => {
            if (nextCalled) {
              continuationError = new ApplicationError({
                message: `Plugin middleware continuation for "${hookName}" was called more than once.`,
                code: 500,
              });
              throw continuationError;
            }
            nextCalled = true;
            try {
              nextResult = dispatch(index + 1);
              return nextResult;
            } catch (thrown) {
              nextError = thrown;
              nextThrew = true;
              throw thrown;
            }
          };
          const argsWithNext = [
            {...(options.args[0] as object), next},
            ...options.args.slice(1),
          ] as Parameters<HookMap[Name]>;
          const result = entry.runner.invokePreparedSync(prepared, argsWithNext, {cache: false});
          if (continuationError != null) throw continuationError;
          if (!result.recovered) return result.value;
          if (nextThrew) throw nextError;
          return nextCalled ? nextResult : dispatch(index + 1);
        };

        return dispatch(0);
      },
      {tags: {strategy: 'pipe'}},
    );
  }

  /**
   * Synchronously runs observers while containing fatal observer failures.
   */
  observeSync<Name extends Extract<keyof HookMap, string>>(
    options: Contracts.PluginContainerExecuteOptions<HookMap, Name>,
  ): void {
    this.ensureNotDisposed();
    const entries = this.getSortedEntries(options.hook);
    if (entries.length === 0) return;

    const contextFactory = options.context ?? this[PLUGIN_CONTAINER_CONTEXT_FACTORY];
    try {
      this.telemetry.measureCallback(
        options.hook,
        () => {
          for (const entry of entries) {
            const contextOptions = contextFactory?.(entry.plugin);
            entry.runner.triggerSync({
              hook: options.hook,
              args: options.args,
              context: contextOptions,
            });
          }
        },
        {tags: {strategy: 'observe'}},
      );
    } catch (thrown) {
      try {
        this.emit('plugin:observation.errored', {
          details: {hook: options.hook, error: thrown},
        });
      } catch {
        // Observation diagnostics are contained with the observer pipeline.
      }
    }
  }

  /**
   * Runs a bounded synchronous callback with one prepared hook executor.
   */
  direct<Name extends Extract<Contracts.PluginSynchronousHookName<HookMap>, string>, Result>(
    options: Contracts.PluginContainerDirectOptions<HookMap, Name, Result>,
  ): Result {
    this.ensureNotDisposed();
    const entries = this.getSortedEntries(options.hook);
    const contextFactory = options.context ?? this[PLUGIN_CONTAINER_CONTEXT_FACTORY];
    const preparedEntries: PreparedRunnerEntry[] = [];

    for (const entry of entries) {
      const contextOptions = contextFactory?.(entry.plugin);
      const invocation = entry.runner.prepareInvocation(options.hook, contextOptions);
      if (invocation != null) preparedEntries.push({runner: entry.runner, invocation});
    }

    const executor = new PluginDirectExecutor<HookMap[Name]>(preparedEntries);
    this[PLUGIN_CONTAINER_DIRECT_SCOPES] += 1;
    try {
      return this.telemetry.measureCallback(
        options.hook,
        () => {
          const result = options.execute(executor);
          if (
            result != null &&
            (typeof result === 'object' || typeof result === 'function') &&
            typeof (result as {then?: unknown}).then === 'function'
          ) {
            void Promise.resolve(result).catch(() => undefined);
            throw new ApplicationError({
              message: 'Plugin direct execution callbacks must be synchronous.',
              code: 500,
            });
          }
          return result;
        },
        {tags: {strategy: 'direct'}},
      );
    } finally {
      executor.close();
      this[PLUGIN_CONTAINER_DIRECT_SCOPES] -= 1;
      this.disposeDeferredRunners();
    }
  }

  /**
   * Composes a value by threading it through all handlers for a hook.
   *
   * Each handler receives the accumulated value as `children` in its
   * first argument and returns a new value that replaces it. A handler
   * may return null or undefined to intentionally gate the value.
   */
  renderable<Name extends Extract<keyof HookMap, string>>(
    options: Contracts.PluginContainerExecuteOptions<HookMap, Name>,
  ): ReturnType<HookMap[Name]> {
    this.ensureNotDisposed();
    const entries = this.getSortedEntries(options.hook);
    const baseArgs = options.args[0] as Record<string, unknown>;
    let current = baseArgs.children;

    if (entries.length === 0) return current as ReturnType<HookMap[Name]>;

    const contextFactory = options.context ?? this[PLUGIN_CONTAINER_CONTEXT_FACTORY];
    const hookName = options.hook;

    return this.telemetry.measureCallback(
      hookName,
      () => {
        for (const entry of entries) {
          const contextOptions = contextFactory?.(entry.plugin);
          const result = entry.runner.triggerSync({
            hook: options.hook,
            args: [{...baseArgs, children: current}] as Parameters<HookMap[Name]>,
            context: contextOptions,
          });
          current = result;
        }
        return current as ReturnType<HookMap[Name]>;
      },
      {tags: {strategy: 'renderable'}},
    );
  }

  /**
   * Creates a child container inheriting this container's plugins.
   */
  fork(options?: Contracts.PluginContainerForkOptions<HookMap>): PluginContainer<HookMap> {
    this.ensureNotDisposed();
    const childFactory = options?.contextFactory ?? this[PLUGIN_CONTAINER_CONTEXT_FACTORY];
    const child = new PluginContainer<HookMap>({
      contextFactory: childFactory,
      telemetry: options?.telemetry ?? this.telemetry,
    });

    for (const runner of this[PLUGIN_CONTAINER_RUNNERS]) {
      const forkedRunner = runner.fork();
      child[PLUGIN_CONTAINER_RUNNERS].push(forkedRunner);
      child.addChild(forkedRunner);
      const plugin = runner.getPlugin();
      if (this[PLUGIN_CONTAINER_PROTECTED].has(plugin)) {
        child[PLUGIN_CONTAINER_PROTECTED].add(plugin);
      }
    }

    if (options?.plugins != null) {
      for (const plugin of options.plugins) {
        const contextOptions = childFactory?.(plugin);
        const runnerTelemetry = child.telemetry.fork(plugin.name);
        const runner = new PluginRunner(plugin, {
          telemetry: runnerTelemetry,
          context: contextOptions,
        });
        child[PLUGIN_CONTAINER_RUNNERS].push(runner);
        child.addChild(runner);
      }
    }

    this.addChild(child);
    this.emit('plugin:container.forked', {details: {childSize: child.size}});
    return child;
  }

  /**
   * Freezes the container, preventing plugin addition and removal.
   */
  freeze(): Contracts.ReadonlyPluginContainer<HookMap> {
    this.ensureNotDisposed();
    this[PLUGIN_CONTAINER_FROZEN] = true;
    this.emit('plugin:container.frozen');
    return this;
  }

  /**
   * Disposes the container and all managed runners.
   */
  dispose(): void {
    this.ensureNotDisposed();
    this[PLUGIN_CONTAINER_DISPOSED] = true;
    this.emit('plugin:container.disposed');
    for (const runner of this[PLUGIN_CONTAINER_RUNNERS]) {
      this.removeChild(runner);
      runner.dispose();
    }
    for (const runner of this[PLUGIN_CONTAINER_DEFERRED_RUNNERS]) {
      runner.dispose();
    }
    this[PLUGIN_CONTAINER_RUNNERS] = [];
    this[PLUGIN_CONTAINER_DEFERRED_RUNNERS].clear();
    this[PLUGIN_CONTAINER_PROTECTED].clear();
    this[PLUGIN_CONTAINER_SORTED].clear();
  }

  /** Returns memoized sorted entries for a hook name. */
  private getSortedEntries(hookName: string): SortedRunnerEntry[] {
    const cached = this[PLUGIN_CONTAINER_SORTED].get(hookName);
    if (cached != null) return cached;

    const pre: SortedRunnerEntry[] = [];
    const normal: SortedRunnerEntry[] = [];
    const post: SortedRunnerEntry[] = [];

    for (const runner of this[PLUGIN_CONTAINER_RUNNERS]) {
      const hook = runner.getHook(hookName);
      if (hook == null) continue;

      const entry: SortedRunnerEntry = {runner, plugin: runner.getPlugin(), hook};

      if (hook.order === 'pre') {
        pre.push(entry);
      } else if (hook.order === 'post') {
        post.push(entry);
      } else {
        normal.push(entry);
      }
    }

    const sorted = [...pre, ...normal, ...post];
    this[PLUGIN_CONTAINER_SORTED].set(hookName, sorted);
    return sorted;
  }

  /** Disposes removed runners after the outermost direct scope completes. */
  private disposeDeferredRunners(): void {
    if (this[PLUGIN_CONTAINER_DIRECT_SCOPES] > 0 || this[PLUGIN_CONTAINER_DISPOSED]) return;
    for (const runner of this[PLUGIN_CONTAINER_DEFERRED_RUNNERS]) {
      runner.dispose();
    }
    this[PLUGIN_CONTAINER_DEFERRED_RUNNERS].clear();
  }

  /** Drains a batch of parallel promises. */
  private async drainParallel(
    promises: Array<Promise<void>>,
    onError: (err: unknown) => void,
  ): Promise<void> {
    if (promises.length === 0) return;
    const results = await Promise.allSettled(promises);
    for (const result of results) {
      if (result.status === 'rejected') {
        onError(result.reason);
      }
    }
    promises.length = 0;
  }

  /** Throws if the container is frozen or disposed. */
  private ensureWritable(): void {
    this.ensureNotDisposed();
    if (this[PLUGIN_CONTAINER_FROZEN]) {
      throw new ApplicationError({
        message: 'Cannot modify a frozen plugin container.',
        code: 500,
      });
    }
  }

  /** Throws if the container has been disposed. */
  private ensureNotDisposed(): void {
    if (this[PLUGIN_CONTAINER_DISPOSED]) {
      throw new ApplicationError({
        message: 'Cannot use a disposed plugin container.',
        code: 500,
      });
    }
  }
}
