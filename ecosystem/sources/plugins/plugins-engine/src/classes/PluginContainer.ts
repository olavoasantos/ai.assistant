import type * as Contracts from '@ai.assistant/contracts/plugins';
import type {Telemetry} from '@ai.assistant/contracts/telemetry';
import {ApplicationError} from '@ai.assistant/error';
import {EventEmitter} from '@ai.assistant/event-emitter';
import {
  PLUGIN_CONTAINER_CONTEXT_FACTORY,
  PLUGIN_CONTAINER_DISPOSED,
  PLUGIN_CONTAINER_FROZEN,
  PLUGIN_CONTAINER_IDENTIFIER,
  PLUGIN_CONTAINER_RUNNERS,
  PLUGIN_CONTAINER_SORTED,
} from '../constants';
import type {PluginContainerEvents, SortedRunnerEntry} from '../types';
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
    const index = this[PLUGIN_CONTAINER_RUNNERS].findIndex(
      (runner) => runner.getPlugin() === plugin,
    );
    if (index !== -1) {
      const runner = this[PLUGIN_CONTAINER_RUNNERS][index];
      this[PLUGIN_CONTAINER_RUNNERS].splice(index, 1);
      this[PLUGIN_CONTAINER_SORTED].clear();
      this.removeChild(runner);
      runner.dispose();
      this.emit('plugin:removed', {details: {plugin: plugin.name}});
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
    options: Contracts.PluginContainerExecuteOptions<HookMap, Name>,
  ): Promise<Awaited<ReturnType<HookMap[Name]>>> {
    this.ensureNotDisposed();
    const entries = this.getSortedEntries(options.hook);
    if (entries.length === 0) return undefined as Awaited<ReturnType<HookMap[Name]>>;

    const contextFactory = options.context ?? this[PLUGIN_CONTAINER_CONTEXT_FACTORY];
    const hookName = options.hook;

    return this.telemetry.measureCallback(
      hookName,
      async () => {
        let index = 0;

        const next = async (): Promise<any> => {
          const entry = entries[index++];
          if (entry == null) return undefined;

          const contextOptions = contextFactory?.(entry.plugin);
          const prepared = entry.runner.prepareInvocation(hookName, contextOptions);
          if (prepared == null) return next();

          const argsWithNext = [{...(options.args[0] as any), next}] as Parameters<HookMap[Name]>;
          return await prepared.handler.apply(prepared.view, argsWithNext);
        };

        return await next();
      },
      {tags: {strategy: 'pipe'}},
    );
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
    options: Contracts.PluginContainerExecuteOptions<HookMap, Name>,
  ): ReturnType<HookMap[Name]> {
    this.ensureNotDisposed();
    const entries = this.getSortedEntries(options.hook);
    if (entries.length === 0) return undefined as ReturnType<HookMap[Name]>;

    const contextFactory = options.context ?? this[PLUGIN_CONTAINER_CONTEXT_FACTORY];
    const hookName = options.hook;

    return this.telemetry.measureCallback(
      hookName,
      () => {
        let index = 0;

        const next = (): any => {
          const entry = entries[index++];
          if (entry == null) return undefined;

          const contextOptions = contextFactory?.(entry.plugin);
          const prepared = entry.runner.prepareInvocation(hookName, contextOptions);
          if (prepared == null) return next();

          const argsWithNext = [{...(options.args[0] as any), next}] as Parameters<HookMap[Name]>;
          return prepared.handler.apply(prepared.view, argsWithNext);
        };

        return next();
      },
      {tags: {strategy: 'pipe'}},
    );
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
    this[PLUGIN_CONTAINER_RUNNERS] = [];
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
