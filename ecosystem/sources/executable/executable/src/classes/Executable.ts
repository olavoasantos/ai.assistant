import type {Services} from '@ai.assistant/contracts';
import type {
  Executable as ExecutableContract,
  ExecutableEventMap,
  ExecutableOptions,
  ExecutableStatus,
  KernelLifecycles,
  LifecycleCallbacks,
} from '@ai.assistant/contracts/executable';
import type {
  ContextFactory,
  Plugin,
  ReadonlyPluginContainer,
} from '@ai.assistant/contracts/plugins';
import type {Renderable} from '@ai.assistant/contracts/renderable';
import type {ReadonlySignal, Signal} from '@ai.assistant/contracts/signals';
import type {TelemetryForkOptions} from '@ai.assistant/contracts/telemetry';
import {ApplicationError} from '@ai.assistant/error';
import {EventEmitter} from '@ai.assistant/event-emitter';
import {PluginContainer, PluginRunner} from '@ai.assistant/plugin-engine';
import {ServiceContainer} from '@ai.assistant/service-container';
import {Telemetry} from '@ai.assistant/telemetry';
import {signal} from '@preact/signals-core';
import {createElement, Fragment} from 'preact';
import {
  EXECUTABLE_DEFAULT_SCOPE,
  EXECUTABLE_ERROR,
  EXECUTABLE_IDENTIFIER,
  EXECUTABLE_KERNEL,
  EXECUTABLE_LIFECYCLES,
  EXECUTABLE_NOOP_KERNEL,
  EXECUTABLE_PARENT,
  EXECUTABLE_PLUGIN_CONTAINER,
  EXECUTABLE_RENDERABLE,
  EXECUTABLE_SCOPE,
  EXECUTABLE_SERVICE_CONTAINER,
  EXECUTABLE_STATUS,
  EXECUTABLE_TELEMETRY,
  EXECUTABLE_TERMINAL_STATES,
  EXECUTABLE_TRANSITIONS,
  EXECUTABLE_UI,
} from '../constants';
import type {ExecutableFactoryInstance, TransitionState} from '../types';

/**
 * Default lifecycle and kernel orchestration implementation.
 *
 * Executable owns state transitions, scoped infrastructure, one kernel, error
 * normalization, rendering, and disposal. It deliberately does not invoke
 * inherited plugins. Specializations select plugin hooks and strategies through
 * lifecycle callbacks, while the kernel always receives the standard executable
 * lifecycle hooks.
 *
 * @template PluginLifecycles - Hook map exposed by the inherited plugin container.
 */
export class Executable<
  PluginLifecycles extends Record<keyof PluginLifecycles, (...args: any[]) => any> =
    KernelLifecycles,
>
  extends EventEmitter<ExecutableEventMap>
  implements ExecutableContract<PluginLifecycles>
{
  /**
   * Construct and initialize an executable.
   *
   * @param options - Scoped infrastructure and specialization behavior.
   * @returns An executable at `initialized` state.
   */
  static async create<Options, Instance extends ExecutableFactoryInstance>(
    this: new (options?: Options) => Instance,
    options?: Options,
  ): Promise<Instance> {
    return await new this(options).initialize();
  }

  /**
   * Construct, initialize, and activate an executable.
   *
   * @param options - Scoped infrastructure and specialization behavior.
   * @returns An executable at `active` state.
   */
  static async activate<Options, Instance extends ExecutableFactoryInstance>(
    this: new (options?: Options) => Instance,
    options?: Options,
  ): Promise<Instance> {
    return await new this(options).activate();
  }

  /** Symbol brand for cross-boundary identity checks. */
  readonly [EXECUTABLE_IDENTIFIER] = true as const;

  /** @internal Parent executable used by deliberate specializations. */
  [EXECUTABLE_PARENT]: Executable<PluginLifecycles> | undefined;

  /** @internal Signal holding the normalized fatal error. */
  [EXECUTABLE_ERROR]: Signal<ApplicationError | null> = signal(null);

  /** @internal Service container for this scope. */
  [EXECUTABLE_SERVICE_CONTAINER]: ServiceContainer<Services>;

  /** @internal Inherited plugin container controlled by the specialization. */
  [EXECUTABLE_PLUGIN_CONTAINER]: PluginContainer<PluginLifecycles>;

  /** @internal Telemetry instance for this scope. */
  [EXECUTABLE_TELEMETRY]: Telemetry;

  /** @internal Local scope segment. */
  [EXECUTABLE_SCOPE]: string;

  /** @internal Signal holding the base renderable. */
  [EXECUTABLE_RENDERABLE]: Signal<Renderable>;

  /** @internal Signal holding the current lifecycle status. */
  [EXECUTABLE_STATUS]: Signal<ExecutableStatus> = signal<ExecutableStatus>('created');

  /** @internal Signal holding the composed renderable. */
  [EXECUTABLE_UI]: Signal<Renderable>;

  /** @internal Runner for this scope's unique kernel. */
  [EXECUTABLE_KERNEL]: PluginRunner<KernelLifecycles>;

  /** @internal Injected specialization behavior. */
  [EXECUTABLE_LIFECYCLES]: LifecycleCallbacks<PluginLifecycles>;

  /** @internal In-flight lifecycle transitions. */
  [EXECUTABLE_TRANSITIONS]: TransitionState = {
    initializing: null,
    activating: null,
    deactivating: null,
    disposing: null,
  };

  /**
   * Construct an inert executable at `created` state.
   *
   * The optional parent is an implementation seam for deliberate executable
   * specializations. Public generic forking is intentionally unsupported.
   *
   * @param options - Scoped infrastructure and specialization behavior.
   * @param parent - Parent executable whose scoped infrastructure is inherited.
   */
  constructor(
    options: ExecutableOptions<PluginLifecycles> = {},
    parent?: Executable<PluginLifecycles>,
  ) {
    super();

    this[EXECUTABLE_PARENT] = parent;
    this[EXECUTABLE_SCOPE] = options.scope ?? (parent ? 'child' : EXECUTABLE_DEFAULT_SCOPE);
    this[EXECUTABLE_LIFECYCLES] = options.lifecycles ?? {};

    const telemetryForkOptions: TelemetryForkOptions | undefined = options.telemetry
      ? {tags: options.telemetry.tags, source: options.telemetry.source}
      : undefined;
    this[EXECUTABLE_TELEMETRY] = parent
      ? parent[EXECUTABLE_TELEMETRY].fork(this[EXECUTABLE_SCOPE], telemetryForkOptions)
      : new Telemetry({...options.telemetry, namespace: this[EXECUTABLE_SCOPE]});
    if (!parent) {
      this.addChild(this[EXECUTABLE_TELEMETRY]);
    }

    this[EXECUTABLE_SERVICE_CONTAINER] = parent
      ? parent[EXECUTABLE_SERVICE_CONTAINER].fork()
      : new ServiceContainer<Services>();
    this.addChild(this[EXECUTABLE_SERVICE_CONTAINER]);

    const contextFactory: ContextFactory<Plugin<PluginLifecycles>> = () => ({
      container: this[EXECUTABLE_SERVICE_CONTAINER],
    });
    const kernel = options.kernel ?? EXECUTABLE_NOOP_KERNEL;
    this[EXECUTABLE_KERNEL] = new PluginRunner<KernelLifecycles>(kernel, {
      telemetry: this[EXECUTABLE_TELEMETRY].fork('kernel'),
      context: {container: this[EXECUTABLE_SERVICE_CONTAINER]},
    });
    this.addChild(this[EXECUTABLE_KERNEL]);

    const pluginTelemetry = this[EXECUTABLE_TELEMETRY].fork('plugins');
    this[EXECUTABLE_PLUGIN_CONTAINER] = parent
      ? parent[EXECUTABLE_PLUGIN_CONTAINER].fork({
          plugins: options.plugins,
          telemetry: pluginTelemetry,
          contextFactory,
        })
      : new PluginContainer<PluginLifecycles>({
          plugins: options.plugins,
          telemetry: pluginTelemetry,
          contextFactory,
        });
    this.addChild(this[EXECUTABLE_PLUGIN_CONTAINER]);

    this[EXECUTABLE_RENDERABLE] = signal(options.renderable ?? createElement(Fragment, null));
    this[EXECUTABLE_UI] = signal(createElement(Fragment, null));

    if (parent) {
      parent.addChild(this);
    }
  }

  /** The scoped service container. */
  get container(): ServiceContainer<Services> {
    return this[EXECUTABLE_SERVICE_CONTAINER];
  }

  /** The normalized fatal error, or `null` while healthy. */
  get error(): ApplicationError | null {
    return this[EXECUTABLE_ERROR].value;
  }

  /** The inherited plugin container controlled by this specialization. */
  get pluginContainer(): ReadonlyPluginContainer<PluginLifecycles> {
    return this[EXECUTABLE_PLUGIN_CONTAINER];
  }

  /** The human-readable local scope segment. */
  get scope(): string {
    return this[EXECUTABLE_SCOPE];
  }

  /** The current lifecycle state. */
  get status(): ExecutableStatus {
    return this[EXECUTABLE_STATUS].value;
  }

  /** The scope's telemetry instance. */
  get telemetry(): Telemetry {
    return this[EXECUTABLE_TELEMETRY];
  }

  /** The fully composed renderable signal. */
  get ui(): ReadonlySignal<Renderable> {
    return this[EXECUTABLE_UI];
  }

  /** Advance a newly created scope through creation and initialization. */
  async initialize(): Promise<this> {
    this.ensureNotTerminal();
    if (this[EXECUTABLE_TRANSITIONS].initializing != null) {
      await this[EXECUTABLE_TRANSITIONS].initializing;
      return this;
    }

    this[EXECUTABLE_TRANSITIONS].initializing = this[EXECUTABLE_TELEMETRY]
      .measureCallback('initialize', async (timer) => {
        await Promise.allSettled([
          this[EXECUTABLE_TRANSITIONS].activating,
          this[EXECUTABLE_TRANSITIONS].deactivating,
        ]);
        if (
          this[EXECUTABLE_STATUS].peek() !== 'created' ||
          this[EXECUTABLE_TRANSITIONS].disposing != null
        ) {
          timer.cancel();
          return;
        }

        this[EXECUTABLE_STATUS].value = 'creating';
        await this[EXECUTABLE_LIFECYCLES].create?.call(this);
        await this[EXECUTABLE_KERNEL].trigger({hook: 'create', args: []});
        this.composeRenderable();

        this[EXECUTABLE_STATUS].value = 'initializing';
        await this[EXECUTABLE_LIFECYCLES].initialize?.call(this);
        await this[EXECUTABLE_KERNEL].trigger({hook: 'initialize', args: []});

        this[EXECUTABLE_STATUS].value = 'initialized';
        this.emit('executable:initialized');
      })
      .catch((thrown: unknown) => this.handleFatalError(thrown))
      .finally(() => {
        this[EXECUTABLE_TRANSITIONS].initializing = null;
      });

    await this[EXECUTABLE_TRANSITIONS].initializing;
    return this;
  }

  /** Activate an initialized or inactive scope, initializing it when needed. */
  async activate(): Promise<this> {
    this.ensureNotTerminal();
    if (this[EXECUTABLE_STATUS].peek() === 'created') {
      await this.initialize();
    }
    if (this[EXECUTABLE_TRANSITIONS].activating != null) {
      await this[EXECUTABLE_TRANSITIONS].activating;
      return this;
    }

    this[EXECUTABLE_TRANSITIONS].activating = this[EXECUTABLE_TELEMETRY]
      .measureCallback('activate', async (timer) => {
        await Promise.allSettled([
          this[EXECUTABLE_TRANSITIONS].initializing,
          this[EXECUTABLE_TRANSITIONS].deactivating,
        ]);
        const current = this[EXECUTABLE_STATUS].peek();
        if (
          (current !== 'initialized' && current !== 'inactive') ||
          this[EXECUTABLE_TRANSITIONS].disposing != null
        ) {
          timer.cancel();
          return;
        }

        this[EXECUTABLE_STATUS].value = 'activating';
        await this[EXECUTABLE_LIFECYCLES].activate?.call(this);
        await this[EXECUTABLE_KERNEL].trigger({hook: 'activate', args: []});
        this[EXECUTABLE_STATUS].value = 'active';
        this.emit('executable:activated');
      })
      .catch((thrown: unknown) => this.handleFatalError(thrown))
      .finally(() => {
        this[EXECUTABLE_TRANSITIONS].activating = null;
      });

    await this[EXECUTABLE_TRANSITIONS].activating;
    return this;
  }

  /** Deactivate an active scope. */
  async deactivate(): Promise<this> {
    this.ensureNotTerminal();
    if (this[EXECUTABLE_TRANSITIONS].deactivating != null) {
      await this[EXECUTABLE_TRANSITIONS].deactivating;
      return this;
    }

    this[EXECUTABLE_TRANSITIONS].deactivating = this[EXECUTABLE_TELEMETRY]
      .measureCallback('deactivate', async (timer) => {
        await Promise.allSettled([
          this[EXECUTABLE_TRANSITIONS].initializing,
          this[EXECUTABLE_TRANSITIONS].activating,
        ]);
        if (
          this[EXECUTABLE_STATUS].peek() !== 'active' ||
          this[EXECUTABLE_TRANSITIONS].disposing != null
        ) {
          timer.cancel();
          return;
        }

        await this.runDeactivationPhase();
      })
      .catch((thrown: unknown) => this.handleFatalError(thrown))
      .finally(() => {
        this[EXECUTABLE_TRANSITIONS].deactivating = null;
      });

    await this[EXECUTABLE_TRANSITIONS].deactivating;
    return this;
  }

  /** Permanently dispose this scope and its owned infrastructure. */
  async dispose(): Promise<this> {
    if (this[EXECUTABLE_STATUS].peek() === 'disposed') {
      throw new ApplicationError({
        message: 'Cannot dispose an already-disposed executable.',
        severity: 'fatal',
      });
    }
    this.ensureNotTerminal();
    if (this[EXECUTABLE_TRANSITIONS].disposing != null) {
      await this[EXECUTABLE_TRANSITIONS].disposing;
      return this;
    }

    this[EXECUTABLE_TRANSITIONS].disposing = this[EXECUTABLE_TELEMETRY]
      .measureCallback('dispose', async () => {
        await Promise.allSettled([
          this[EXECUTABLE_TRANSITIONS].initializing,
          this[EXECUTABLE_TRANSITIONS].activating,
          this[EXECUTABLE_TRANSITIONS].deactivating,
        ]);
        if (this[EXECUTABLE_STATUS].peek() === 'active') {
          await this.runDeactivationPhase();
        }

        this[EXECUTABLE_STATUS].value = 'disposing';
        await this.runDisposalPhase();
      })
      .then(() => {
        this[EXECUTABLE_TELEMETRY].dispose();
        this.detachFromParent();
        this[EXECUTABLE_STATUS].value = 'disposed';
        this.emit('executable:disposed');
      })
      .catch((thrown: unknown) => {
        try {
          this[EXECUTABLE_TELEMETRY].dispose();
        } catch {
          // The first disposal failure remains authoritative.
        }
        this.detachFromParent();
        return this.handleFatalError(thrown);
      })
      .finally(() => {
        this[EXECUTABLE_TRANSITIONS].disposing = null;
      });

    await this[EXECUTABLE_TRANSITIONS].disposing;
    return this;
  }

  /** Compose the base renderable through specialization and kernel layers. */
  protected composeRenderable(): void {
    this[EXECUTABLE_UI].value = this[EXECUTABLE_LIFECYCLES].renderable
      ? this[EXECUTABLE_LIFECYCLES].renderable.call(this, this[EXECUTABLE_RENDERABLE].value)
      : this[EXECUTABLE_RENDERABLE].value;
    if (this[EXECUTABLE_KERNEL].has('ui')) {
      this[EXECUTABLE_UI].value = this[EXECUTABLE_KERNEL].triggerSync({
        hook: 'ui',
        args: [{children: this[EXECUTABLE_UI].value}],
      });
    }
  }

  /** Update and immediately recompose the base renderable. */
  protected render(renderable: Renderable): void {
    this[EXECUTABLE_RENDERABLE].value = renderable;
    this.composeRenderable();
  }

  /** Run the complete deactivation phase. */
  protected async runDeactivationPhase(): Promise<void> {
    this[EXECUTABLE_STATUS].value = 'deactivating';
    await this[EXECUTABLE_LIFECYCLES].deactivate?.call(this);
    await this[EXECUTABLE_KERNEL].trigger({hook: 'deactivate', args: []});
    this[EXECUTABLE_STATUS].value = 'inactive';
    this.emit('executable:deactivated');
  }

  /** Run disposal callbacks and cleanup while retaining the first failure. */
  protected async runDisposalPhase(): Promise<void> {
    let firstFailure: unknown;

    try {
      await this[EXECUTABLE_LIFECYCLES].dispose?.call(this);
    } catch (thrown) {
      firstFailure = thrown;
    }
    try {
      await this[EXECUTABLE_KERNEL].trigger({hook: 'dispose', args: []});
    } catch (thrown) {
      firstFailure ??= thrown;
    }
    try {
      this[EXECUTABLE_KERNEL].dispose();
    } catch (thrown) {
      firstFailure ??= thrown;
    }
    try {
      this[EXECUTABLE_PLUGIN_CONTAINER].dispose();
    } catch (thrown) {
      firstFailure ??= thrown;
    }
    try {
      await this[EXECUTABLE_SERVICE_CONTAINER].dispose();
    } catch (thrown) {
      firstFailure ??= thrown;
    }

    if (firstFailure != null) {
      throw firstFailure;
    }
  }

  /** Detach this scope from its executable parent. */
  protected detachFromParent(): void {
    if (this[EXECUTABLE_PARENT]) {
      this[EXECUTABLE_PARENT].removeChild(this);
      this[EXECUTABLE_PARENT] = undefined;
    }
  }

  /** Reject lifecycle control in terminal states. */
  protected ensureNotTerminal(): void {
    const current = this[EXECUTABLE_STATUS].peek();
    if (EXECUTABLE_TERMINAL_STATES.has(current)) {
      throw new ApplicationError({
        message: `Cannot perform lifecycle operation on executable in '${current}' state.`,
        severity: 'fatal',
      });
    }
  }

  /** Normalize, publish, and rethrow a fatal lifecycle failure. */
  protected handleFatalError(thrown: unknown): never {
    const error = ApplicationError.from(thrown);

    try {
      this[EXECUTABLE_LIFECYCLES].error?.call(this, error);
    } catch {
      // The original lifecycle failure remains authoritative.
    }
    try {
      this[EXECUTABLE_KERNEL].triggerSync({hook: 'error', args: [error]});
    } catch {
      // Error hooks cannot replace the original lifecycle failure.
    }

    this[EXECUTABLE_ERROR].value = error;
    this[EXECUTABLE_STATUS].value = 'error';
    try {
      this.emit('executable:errored', {details: error});
    } catch {
      // Error listeners cannot replace the original lifecycle failure.
    }
    throw error;
  }
}
