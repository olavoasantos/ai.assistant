import type * as Contracts from '@ai.assistant/contracts/plugins';
import type {Telemetry} from '@ai.assistant/contracts/telemetry';
import {ApplicationError} from '@ai.assistant/error';
import {
  PLUGIN_CONTEXT_DISPOSED,
  PLUGIN_CONTEXT_FROZEN,
  PLUGIN_CONTEXT_NAME,
  PLUGIN_CONTEXT_OPTIONS,
  PLUGIN_CONTEXT_STORE,
  PLUGIN_CONTEXT_TELEMETRY,
} from '../constants';

/**
 * Per-plugin execution context bound as `this` on every hook invocation.
 *
 * Provides scoped access to framework infrastructure (via PluginContextOptions)
 * and a typed cross-hook store for maintaining state across hooks.
 *
 * The plugin runner creates one context per plugin at construction time.
 * Child runners receive forked contexts via {@link PluginContext.fork}.
 *
 * @template PluginName - The literal plugin name, used to resolve the store type.
 */
export class PluginContext<
  PluginName extends string = string,
> implements Contracts.PluginContext<PluginName> {
  /** @internal */
  [PLUGIN_CONTEXT_NAME]: PluginName;

  /** @internal */
  [PLUGIN_CONTEXT_STORE]: Record<string, unknown>;

  /** @internal */
  [PLUGIN_CONTEXT_OPTIONS]: Contracts.PluginContextOptions;

  /** @internal */
  [PLUGIN_CONTEXT_TELEMETRY]: Telemetry;

  /** @internal */
  [PLUGIN_CONTEXT_FROZEN] = false;

  /** @internal */
  [PLUGIN_CONTEXT_DISPOSED] = false;

  /**
   * Creates a new plugin context.
   *
   * @param name - The plugin name.
   * @param options - Scoped infrastructure options.
   * @param store - Pre-existing store object. Defaults to empty.
   */
  constructor(
    name: PluginName,
    telemetry: Telemetry,
    options?: Contracts.PluginContextOptions,
    store?: Record<string, unknown>,
  ) {
    this[PLUGIN_CONTEXT_NAME] = name;
    this[PLUGIN_CONTEXT_TELEMETRY] = telemetry;
    this[PLUGIN_CONTEXT_OPTIONS] = options ?? ({} as Contracts.PluginContextOptions);
    this[PLUGIN_CONTEXT_STORE] = store ?? {};
  }

  /** The plugin name this context belongs to. */
  get name(): PluginName {
    return this[PLUGIN_CONTEXT_NAME];
  }

  /**
   * Typed cross-hook state store for this plugin.
   *
   * The store starts empty. Plugins populate it during hook execution —
   * every property requires a presence check before use.
   */
  get store(): PluginName extends keyof Contracts.PluginStore
    ? Partial<Contracts.PluginStore[PluginName]>
    : unknown {
    this.ensureNotDisposed();
    return this[PLUGIN_CONTEXT_STORE] as any;
  }

  /** The telemetry instance scoped to this plugin. */
  get telemetry(): Telemetry {
    return this[PLUGIN_CONTEXT_TELEMETRY];
  }

  /**
   * Creates a child context with a shallow-copied store.
   *
   * When options are provided, they replace the context's infrastructure.
   * When omitted, the child inherits parent infrastructure by reference.
   *
   * @param options - Scoped infrastructure for the child context.
   * @returns A new child plugin context.
   */
  fork(options?: Contracts.PluginContextOptions): PluginContext<PluginName> {
    this.ensureNotDisposed();
    this.ensureNotFrozen();
    return new PluginContext(
      this[PLUGIN_CONTEXT_NAME],
      this[PLUGIN_CONTEXT_TELEMETRY],
      options ?? this[PLUGIN_CONTEXT_OPTIONS],
      {...this[PLUGIN_CONTEXT_STORE]},
    );
  }

  /**
   * Freezes the context, preventing further forking.
   *
   * @returns A read-only view of this context.
   */
  freeze(): Contracts.ReadonlyPluginContext<PluginName> {
    this[PLUGIN_CONTEXT_FROZEN] = true;
    return this;
  }

  /**
   * Disposes the context and releases resources.
   *
   * After disposal, any interaction with the context throws.
   */
  dispose(): void {
    this.ensureNotDisposed();
    this[PLUGIN_CONTEXT_STORE] = {};
    this[PLUGIN_CONTEXT_DISPOSED] = true;
  }

  /**
   * Builds the readonly view used as `this` in hook handlers.
   *
   * Merges the persistent context properties with any per-invocation
   * options override.
   *
   * @internal
   */
  buildReadonlyView(
    optionsOverride?: Contracts.PluginContextOptions,
  ): Contracts.HookContext<PluginName> {
    const options = optionsOverride ?? this[PLUGIN_CONTEXT_OPTIONS];
    return Object.freeze({
      ...options,
      name: this[PLUGIN_CONTEXT_NAME],
      store: this[PLUGIN_CONTEXT_STORE],
      telemetry: this[PLUGIN_CONTEXT_TELEMETRY],
    }) as unknown as Contracts.HookContext<PluginName>;
  }

  /** Throws if the context has been disposed. */
  private ensureNotDisposed(): void {
    if (this[PLUGIN_CONTEXT_DISPOSED]) {
      throw new ApplicationError({
        message: `Cannot use a disposed plugin context for "${this[PLUGIN_CONTEXT_NAME]}".`,
        code: 500,
      });
    }
  }

  /** Throws if the context has been frozen. */
  private ensureNotFrozen(): void {
    if (this[PLUGIN_CONTEXT_FROZEN]) {
      throw new ApplicationError({
        message: `Cannot fork a frozen plugin context for "${this[PLUGIN_CONTEXT_NAME]}".`,
        code: 500,
      });
    }
  }
}
