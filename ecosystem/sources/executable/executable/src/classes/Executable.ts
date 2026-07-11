import type {Services} from '@ai.assistant/contracts';
import type {
  Executable as ExecutableContract,
  ExecutableEventMap,
  ExecutableOptions,
  ExecutableStatus,
  KernelLifecycles,
  LifecycleCallbacks,
} from '@ai.assistant/contracts/executable';
import type {ContextFactory, ReadonlyPluginContainer} from '@ai.assistant/contracts/plugins';
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
import type {TransitionState} from '../types';

/**
 * Default lifecycle and scope implementation for executable entities.
 *
 * The class owns lifecycle state, scoped foundation infrastructure, plugin and
 * kernel orchestration, rendering composition, fatal-error normalization, and
 * child-scope inheritance. Specializations inject phase behavior through
 * {@link ExecutableOptions.lifecycles} rather than replacing state-machine
 * methods.
 *
 * @example
 * ```ts
 * const executable = await Executable.activate({
 *   scope: 'worker',
 *   lifecycles: {
 *     create() {
 *       this.container.value('Configuration', configuration);
 *     },
 *   },
 * });
 * ```
 */
export class Executable extends EventEmitter<ExecutableEventMap> implements ExecutableContract {
  /**
   * Construct and initialize an executable.
   *
   * @param options - Scope infrastructure and lifecycle behavior.
   * @returns An executable at `initialized` state.
   */
  static async create(
    this: new (options?: ExecutableOptions) => Executable,
    options?: ExecutableOptions,
  ): Promise<Executable> {
    const executable = new this(options);
    await executable.initialize();
    return executable;
  }

  /**
   * Construct, initialize, and activate an executable.
   *
   * @param options - Scope infrastructure and lifecycle behavior.
   * @returns An executable at `active` state.
   */
  static async activate(
    this: new (options?: ExecutableOptions) => Executable,
    options?: ExecutableOptions,
  ): Promise<Executable> {
    const executable = new this(options);
    await executable.activate();
    return executable;
  }

  /** Symbol brand for cross-boundary identity checks. */
  readonly [EXECUTABLE_IDENTIFIER] = true as const;

  /** @internal Parent executable in the scope chain. */
  [EXECUTABLE_PARENT]: Executable | undefined;

  /** @internal Signal holding the normalized fatal error. */
  [EXECUTABLE_ERROR]: Signal<ApplicationError | null> = signal(null);

  /** @internal Service container for this scope. */
  [EXECUTABLE_SERVICE_CONTAINER]: ServiceContainer<Services>;

  /** @internal Ordinary plugin container for this scope. */
  [EXECUTABLE_PLUGIN_CONTAINER]: PluginContainer<KernelLifecycles>;

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

  /** @internal Runner for the scope's kernel. */
  [EXECUTABLE_KERNEL]: PluginRunner<KernelLifecycles>;

  /** @internal Injected lifecycle callbacks. */
  [EXECUTABLE_LIFECYCLES]: LifecycleCallbacks;

  /** @internal In-flight lifecycle transitions. */
  [EXECUTABLE_TRANSITIONS]: TransitionState = {
    initializing: null,
    activating: null,
    deactivating: null,
    disposing: null,
  };

  /**
   * Construct an executable at `created` state.
   *
   * Construction wires owned infrastructure but invokes no lifecycle behavior
   * and starts no asynchronous work.
   *
   * @param options - Scope infrastructure and lifecycle behavior.
   * @param parent - Parent executable used internally by {@link fork}.
   */
  constructor(options: ExecutableOptions = {}, parent?: Executable) {
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

    const contextFactory: ContextFactory = () => ({
      container: this[EXECUTABLE_SERVICE_CONTAINER],
    });
    this[EXECUTABLE_KERNEL] = new PluginRunner<KernelLifecycles>(
      options.kernel ?? EXECUTABLE_NOOP_KERNEL,
      {
        telemetry: this[EXECUTABLE_TELEMETRY].fork('kernel'),
        context: contextFactory(options.kernel ?? EXECUTABLE_NOOP_KERNEL),
      },
    );
    this.addChild(this[EXECUTABLE_KERNEL]);

    const pluginTelemetry = this[EXECUTABLE_TELEMETRY].fork('plugins');
    this[EXECUTABLE_PLUGIN_CONTAINER] = parent
      ? parent[EXECUTABLE_PLUGIN_CONTAINER].fork({
          plugins: options.plugins,
          telemetry: pluginTelemetry,
          contextFactory,
        })
      : new PluginContainer<KernelLifecycles>({
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

  /** The ordinary plugin container for this scope. */
  get pluginContainer(): ReadonlyPluginContainer<KernelLifecycles> {
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

  /** The telemetry instance for this scope. */
  get telemetry(): Telemetry {
    return this[EXECUTABLE_TELEMETRY];
  }

  /** The fully composed renderable signal. */
  get ui(): ReadonlySignal<Renderable> {
    return this[EXECUTABLE_UI];
  }

  /**
   * Advance a newly created scope through creation and initialization.
   *
   * @returns This executable after the transition settles.
   */
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
        await this[EXECUTABLE_PLUGIN_CONTAINER].parallel({hook: 'create', args: []});
        await this[EXECUTABLE_KERNEL].trigger({hook: 'create', args: []});

        this.composeRenderable();

        this[EXECUTABLE_STATUS].value = 'initializing';
        await this[EXECUTABLE_LIFECYCLES].initialize?.call(this);
        await this[EXECUTABLE_PLUGIN_CONTAINER].sequential({hook: 'initialize', args: []});
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

  /**
   * Activate an initialized or inactive scope.
   *
   * @returns This executable after the transition settles.
   */
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
        if (
          !['initialized', 'inactive'].includes(this[EXECUTABLE_STATUS].peek()) ||
          this[EXECUTABLE_TRANSITIONS].disposing != null
        ) {
          timer.cancel();
          return;
        }

        this[EXECUTABLE_STATUS].value = 'activating';
        await this[EXECUTABLE_LIFECYCLES].activate?.call(this);
        await this[EXECUTABLE_PLUGIN_CONTAINER].sequential({hook: 'activate', args: []});
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

  /**
   * Deactivate an active scope.
   *
   * @returns This executable after the transition settles.
   */
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

  /**
   * Permanently dispose this scope and its owned infrastructure.
   *
   * @returns This executable after disposal settles.
   * @throws When the executable is already disposed or has fatally failed.
   */
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

  /**
   * Create a child scope while preserving the runtime subclass.
   *
   * @param options - Child-specific scope and lifecycle options.
   * @returns A child executable at `created` state.
   */
  fork(options: ExecutableOptions = {}): Executable {
    this.ensureNotTerminal();
    return new (this.constructor as new (options?: ExecutableOptions, parent?: Executable) => this)(
      options,
      this,
    );
  }

  /** Compose the base renderable through callbacks, plugins, and kernel. */
  protected composeRenderable(): void {
    this[EXECUTABLE_UI].value = this[EXECUTABLE_LIFECYCLES].renderable
      ? this[EXECUTABLE_LIFECYCLES].renderable.call(this, this[EXECUTABLE_RENDERABLE].value)
      : this[EXECUTABLE_RENDERABLE].value;
    this[EXECUTABLE_UI].value = this[EXECUTABLE_PLUGIN_CONTAINER].renderable({
      hook: 'ui',
      args: [{children: this[EXECUTABLE_UI].value}],
    });
    if (this[EXECUTABLE_KERNEL].has('ui')) {
      this[EXECUTABLE_UI].value = this[EXECUTABLE_KERNEL].triggerSync({
        hook: 'ui',
        args: [{children: this[EXECUTABLE_UI].value}],
      });
    }
  }

  /** Run the complete deactivation phase. */
  protected async runDeactivationPhase(): Promise<void> {
    this[EXECUTABLE_STATUS].value = 'deactivating';
    await this[EXECUTABLE_LIFECYCLES].deactivate?.call(this);
    await this[EXECUTABLE_PLUGIN_CONTAINER].sequential({hook: 'deactivate', args: []});
    await this[EXECUTABLE_KERNEL].trigger({hook: 'deactivate', args: []});
    this[EXECUTABLE_STATUS].value = 'inactive';
    this.emit('executable:deactivated');
  }

  /** Run disposal hooks and owned cleanup while retaining the first failure. */
  protected async runDisposalPhase(): Promise<void> {
    let firstFailure: unknown;

    try {
      await this[EXECUTABLE_LIFECYCLES].dispose?.call(this);
    } catch (thrown) {
      firstFailure = thrown;
    }
    try {
      await this[EXECUTABLE_PLUGIN_CONTAINER].sequential({hook: 'dispose', args: []});
    } catch (thrown) {
      firstFailure ??= thrown;
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
      this[EXECUTABLE_PLUGIN_CONTAINER].sequentialSync({hook: 'error', args: [error]});
    } catch {
      // Error hooks cannot replace the original lifecycle failure.
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
