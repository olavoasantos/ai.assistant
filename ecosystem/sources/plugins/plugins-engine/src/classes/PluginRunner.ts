import type * as Contracts from '@ai.assistant/contracts/plugins';
import type {Telemetry} from '@ai.assistant/contracts/telemetry';
import {ApplicationError} from '@ai.assistant/error';
import {EventEmitter} from '@ai.assistant/event-emitter';
import {
  PLUGIN_RUNNER_CACHE,
  PLUGIN_RUNNER_CONTEXT,
  PLUGIN_RUNNER_DISPOSED,
  PLUGIN_RUNNER_FROZEN,
  PLUGIN_RUNNER_HOOKS,
  PLUGIN_RUNNER_IDENTIFIER,
  PLUGIN_RUNNER_PLUGIN,
  PLUGIN_RUNNER_TELEMETRY,
} from '../constants';
import type {CacheEntry, NormalizedHook, PluginRunnerEvents} from '../types';
import {PluginContext} from './PluginContext';

/**
 * Options for constructing a {@link PluginRunner}.
 */
export interface PluginRunnerOptions {
  /** Telemetry client for measuring hook execution. */
  telemetry: Telemetry;

  /** Context options for the plugin. */
  context?: Contracts.PluginContextOptions;
}

/**
 * A plugin runner that manages a single plugin's execution.
 *
 * Wraps one plugin definition, normalizes its hooks, and provides
 * trigger methods for hook invocation. Owns the plugin's
 * {@link PluginContext} and manages its lifecycle.
 *
 * The runner is a self-contained execution unit: it handles caching,
 * error policy (via errorHandler → severity), and telemetry measurement.
 * Fatal errors are thrown; recoverable errors are emitted and swallowed.
 *
 * @template HookMap - The hook map defining available hooks.
 */
export class PluginRunner<
  HookMap extends Record<keyof HookMap, (...args: any[]) => any> = Contracts.Lifecycles,
>
  extends EventEmitter<PluginRunnerEvents>
  implements Contracts.PluginRunner<HookMap>
{
  /** Symbol brand for cross-boundary identity checks. */
  readonly [PLUGIN_RUNNER_IDENTIFIER] = true as const;

  /** @internal The raw plugin definition. */
  [PLUGIN_RUNNER_PLUGIN]: Contracts.Plugin<HookMap>;

  /** @internal Normalized hooks keyed by hook name. */
  [PLUGIN_RUNNER_HOOKS]: Map<string, NormalizedHook>;

  /** @internal The plugin's persistent context. */
  [PLUGIN_RUNNER_CONTEXT]: PluginContext;

  /** @internal Per-hook result cache. */
  [PLUGIN_RUNNER_CACHE]: Map<string, CacheEntry> = new Map();

  /** @internal Telemetry client for measuring execution. */
  [PLUGIN_RUNNER_TELEMETRY]: Telemetry;

  /** @internal */
  [PLUGIN_RUNNER_FROZEN] = false;

  /** @internal */
  [PLUGIN_RUNNER_DISPOSED] = false;

  /**
   * Creates a new plugin runner.
   *
   * @param plugin - The plugin definition to manage.
   * @param options - Optional construction options.
   */
  constructor(plugin: Contracts.Plugin<HookMap>, options: PluginRunnerOptions) {
    super();
    this[PLUGIN_RUNNER_PLUGIN] = plugin;
    this[PLUGIN_RUNNER_HOOKS] = this.normalizeAllHooks(plugin);
    this[PLUGIN_RUNNER_CONTEXT] = new PluginContext(
      plugin.name,
      options.telemetry,
      options.context,
    );
    this[PLUGIN_RUNNER_TELEMETRY] = options.telemetry;
  }

  /** The plugin name this runner manages. */
  get name(): string {
    return this[PLUGIN_RUNNER_PLUGIN].name;
  }

  /**
   * Triggers a hook on the managed plugin asynchronously.
   *
   * Returns `undefined` if the plugin has no handler for the hook.
   * Recoverable errors are emitted as events and swallowed (returns `undefined`).
   * Fatal errors are thrown.
   *
   * @template Name - The hook name to trigger.
   * @param options - The hook name, arguments, and optional context.
   * @returns The handler's return value, or `undefined`.
   */
  async trigger<Name extends Extract<keyof HookMap, string>>(
    options: Contracts.PluginRunnerTriggerOptions<HookMap, Name>,
  ): Promise<Awaited<ReturnType<HookMap[Name]>> | undefined> {
    this.ensureNotDisposed();
    const hook = this[PLUGIN_RUNNER_HOOKS].get(options.hook);
    if (hook == null) return undefined;

    const hookName = options.hook;

    return this[PLUGIN_RUNNER_TELEMETRY].measureCallback(hookName, async () => {
      try {
        return await this.invokeHandler(hook, hookName, options.args, options.context);
      } catch (thrown) {
        return this.handleError(thrown, hook, hookName, options.args);
      }
    });
  }

  /**
   * Triggers a hook on the managed plugin synchronously.
   *
   * Returns `undefined` if the plugin has no handler for the hook.
   * Recoverable errors are emitted as events and swallowed (returns `undefined`).
   * Fatal errors are thrown.
   *
   * @template Name - The hook name to trigger.
   * @param options - The hook name, arguments, and optional context.
   * @returns The handler's return value, or `undefined`.
   */
  triggerSync<Name extends Extract<keyof HookMap, string>>(
    options: Contracts.PluginRunnerTriggerOptions<HookMap, Name>,
  ): ReturnType<HookMap[Name]> | undefined {
    this.ensureNotDisposed();
    const hook = this[PLUGIN_RUNNER_HOOKS].get(options.hook);
    if (hook == null) return undefined;

    const hookName = options.hook;

    return this[PLUGIN_RUNNER_TELEMETRY].measureCallback(hookName, () => {
      try {
        return this.invokeHandlerSync(hook, hookName, options.args, options.context);
      } catch (thrown) {
        return this.handleError(thrown, hook, hookName, options.args);
      }
    }) as ReturnType<HookMap[Name]> | undefined;
  }

  /**
   * Checks whether the managed plugin has a handler for the given hook.
   *
   * @param hook - The hook name to check.
   * @returns `true` if a handler is registered.
   */
  has<Name extends Extract<keyof HookMap, string>>(hook: Name): boolean {
    this.ensureNotDisposed();
    return this[PLUGIN_RUNNER_HOOKS].has(hook as string);
  }

  /**
   * Checks whether the managed plugin has no handler for the given hook.
   *
   * @param hook - The hook name to check.
   * @returns `true` if no handler is registered.
   */
  missing<Name extends Extract<keyof HookMap, string>>(hook: Name): boolean {
    return !this.has(hook);
  }

  /**
   * Creates a child runner with a forked context (store copied).
   *
   * The caller is responsible for establishing the parent-child
   * EventEmitter relationship if needed.
   *
   * @returns A new child plugin runner.
   */
  fork(): PluginRunner<HookMap> {
    this.ensureNotDisposed();
    this.ensureNotFrozen();
    const child = new PluginRunner<HookMap>(this[PLUGIN_RUNNER_PLUGIN], {
      telemetry: this[PLUGIN_RUNNER_TELEMETRY],
    });
    child[PLUGIN_RUNNER_CONTEXT] = this[PLUGIN_RUNNER_CONTEXT].fork();
    child[PLUGIN_RUNNER_HOOKS] = this[PLUGIN_RUNNER_HOOKS];
    return child;
  }

  /**
   * Freezes the runner, preventing forking.
   *
   * Trigger methods remain available.
   *
   * @returns A read-only view of this runner.
   */
  freeze(): Contracts.ReadonlyPluginRunner<HookMap> {
    this.ensureNotDisposed();
    this[PLUGIN_RUNNER_FROZEN] = true;
    return this;
  }

  /**
   * Disposes the runner and its managed context.
   *
   * After disposal, any interaction with the runner throws.
   */
  dispose(): void {
    this.ensureNotDisposed();
    this[PLUGIN_RUNNER_DISPOSED] = true;
    this[PLUGIN_RUNNER_CONTEXT].dispose();
    this[PLUGIN_RUNNER_CACHE].clear();
  }

  /**
   * Returns the normalized hook for a given name, or undefined.
   *
   * @internal Used by the PluginContainer for sorted hook resolution.
   */
  getHook(name: string): NormalizedHook | undefined {
    return this[PLUGIN_RUNNER_HOOKS].get(name);
  }

  /**
   * Returns the managed plugin definition.
   *
   * @internal Used by the PluginContainer.
   */
  getPlugin(): Contracts.Plugin<HookMap> {
    return this[PLUGIN_RUNNER_PLUGIN];
  }

  /**
   * Prepares a hook for raw invocation by the pipe strategy.
   *
   * Performs lifecycle checks and builds the context view, but does
   * NOT invoke the handler — returns the handler + view for the
   * caller to invoke with custom arguments (e.g. with `next` injected).
   *
   * @internal Used by PluginContainer for pipe/pipeSync strategies.
   */
  prepareInvocation(
    hookName: string,
    contextOverride?: Contracts.PluginContextOptions,
  ): {handler: (...args: any[]) => any; view: Contracts.HookContext} | undefined {
    this.ensureNotDisposed();
    const hook = this[PLUGIN_RUNNER_HOOKS].get(hookName);
    if (hook == null) return undefined;

    const view = this[PLUGIN_RUNNER_CONTEXT].buildReadonlyView(contextOverride);
    return {handler: hook.handler, view};
  }

  /** Invokes the hook handler (async path) with context binding and caching. */
  private async invokeHandler(
    hook: NormalizedHook,
    hookName: string,
    args: any[],
    contextOverride?: Contracts.PluginContextOptions,
  ): Promise<any> {
    if (hook.cacheHandler != null) {
      const cacheResult = this.resolveCache(hookName, hook.cacheHandler, args);
      if (cacheResult.hit) return cacheResult.value;

      const view = this[PLUGIN_RUNNER_CONTEXT].buildReadonlyView(contextOverride);
      const result = await hook.handler.apply(view, args);
      this.storeCache(cacheResult.key, result, cacheResult.ttl);
      return result;
    }

    const view = this[PLUGIN_RUNNER_CONTEXT].buildReadonlyView(contextOverride);
    return await hook.handler.apply(view, args);
  }

  /** Invokes the hook handler (sync path) with context binding and caching. */
  private invokeHandlerSync(
    hook: NormalizedHook,
    hookName: string,
    args: any[],
    contextOverride?: Contracts.PluginContextOptions,
  ): any {
    if (hook.cacheHandler != null) {
      const cacheResult = this.resolveCache(hookName, hook.cacheHandler, args);
      if (cacheResult.hit) return cacheResult.value;

      const view = this[PLUGIN_RUNNER_CONTEXT].buildReadonlyView(contextOverride);
      const result = hook.handler.apply(view, args);
      this.storeCache(cacheResult.key, result, cacheResult.ttl);
      return result;
    }

    const view = this[PLUGIN_RUNNER_CONTEXT].buildReadonlyView(contextOverride);
    return hook.handler.apply(view, args);
  }

  /**
   * Handles a thrown error from a hook invocation.
   *
   * If the hook has an errorHandler that returns 'recoverable', the error
   * is emitted as an event and swallowed (returns undefined).
   * Otherwise (fatal or no handler), the error is re-thrown.
   */
  private handleError(
    thrown: unknown,
    hook: NormalizedHook,
    hookName: string,
    args: any[],
  ): undefined {
    if (hook.errorHandler != null) {
      try {
        const severity = hook.errorHandler(thrown, ...args);
        if (severity === 'recoverable') {
          this.emit('plugin:hook.error', {
            details: {plugin: this.name, hook: hookName, error: thrown},
          });
          return undefined;
        }
      } catch {
        // Error handler itself threw — escalate to fatal
      }
    }

    // Fatal: enrich and re-throw
    throw ApplicationError.from(thrown)
      .set('severity', 'fatal')
      .setMany({
        metadata: {plugin: this.name, hook: hookName},
      });
  }

  /** Resolves a cached value for a hook invocation. */
  private resolveCache(
    hookName: string,
    cacheHandler: NonNullable<NormalizedHook['cacheHandler']>,
    args: any[],
  ):
    | {hit: true; value: unknown; key: string; ttl: undefined}
    | {hit: false; key: string; ttl: number | undefined} {
    const cacheOptions = cacheHandler(...args);
    const key = `${hookName}:${cacheOptions.key ?? ''}`;

    const entry = this[PLUGIN_RUNNER_CACHE].get(key);
    if (entry != null) {
      if (entry.expiresAt == null || entry.expiresAt > Date.now()) {
        this.emit('plugin:hook.cache.hit', {
          details: {plugin: this.name, hook: hookName, key},
        });
        return {hit: true, value: entry.value, key, ttl: undefined};
      }
      this[PLUGIN_RUNNER_CACHE].delete(key);
    }

    return {hit: false, key, ttl: cacheOptions.ttl};
  }

  /** Stores a value in the cache. */
  private storeCache(key: string, value: unknown, ttl: number | undefined): void {
    this[PLUGIN_RUNNER_CACHE].set(key, {
      value,
      expiresAt: ttl != null ? Date.now() + ttl : undefined,
    });
  }

  /** Normalizes all hooks from a plugin definition. */
  private normalizeAllHooks(plugin: Contracts.Plugin<HookMap>): Map<string, NormalizedHook> {
    const hooks = new Map<string, NormalizedHook>();

    for (const key of Object.keys(plugin)) {
      if (key === 'name') continue;
      const raw = (plugin as Record<string, unknown>)[key];
      if (raw == null) continue;

      hooks.set(key, this.normalizeHook(raw));
    }

    return hooks;
  }

  /** Normalizes a bare function or HookDefinition object into a NormalizedHook. */
  private normalizeHook(raw: unknown): NormalizedHook {
    if (typeof raw === 'function') {
      return {
        handler: raw as (...args: any[]) => any,
        order: undefined,
        errorHandler: undefined,
        cacheHandler: undefined,
        sequential: false,
      };
    }

    const obj = raw as {
      handler: (...args: any[]) => any;
      order?: Contracts.HookOrder;
      errorHandler?: (thrown: unknown, ...args: any[]) => any;
      cacheHandler?: (...args: any[]) => Contracts.HookCacheOptions;
      sequential?: boolean;
    };

    return {
      handler: obj.handler,
      order: obj.order,
      errorHandler: obj.errorHandler,
      cacheHandler: obj.cacheHandler,
      sequential: obj.sequential ?? false,
    };
  }

  /** Throws if the runner has been disposed. */
  private ensureNotDisposed(): void {
    if (this[PLUGIN_RUNNER_DISPOSED]) {
      throw new ApplicationError({
        message: `Cannot use a disposed plugin runner for "${this.name}".`,
        code: 500,
      });
    }
  }

  /** Throws if the runner has been frozen. */
  private ensureNotFrozen(): void {
    if (this[PLUGIN_RUNNER_FROZEN]) {
      throw new ApplicationError({
        message: `Cannot fork a frozen plugin runner for "${this.name}".`,
        code: 500,
      });
    }
  }
}
