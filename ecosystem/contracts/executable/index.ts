/**
 * Contracts for lifecycle-controlled executable scopes.
 *
 * An executable coordinates scoped services, telemetry, rendering, lifecycle
 * transitions, and one kernel. Specializations decide which hooks inherited
 * plugins receive through lifecycle callbacks.
 */
import type {KernelLifecycles as ExtendedKernelLifecycles, Services} from '..';
import type {ApplicationError} from '../error';
import type {EventEmitter} from '../events';
import type {HookContext, Plugin, ReadonlyPluginContainer} from '../plugins';
import type {Renderable} from '../renderable';
import type {ServiceContainer} from '../service-container';
import type {ReadonlySignal} from '../signals';
import type {Telemetry, TelemetryOptions} from '../telemetry';
import type {MaybeAsync} from '../utilities';

/**
 * Lifecycle hooks implemented by executable kernels.
 *
 * @template PluginName - Literal kernel name used for typed context state.
 */
export interface KernelLifecycles<
  PluginName extends string = string,
> extends ExtendedKernelLifecycles<PluginName> {
  /** Register services and bindings for the executable scope. */
  create(this: HookContext<PluginName>): MaybeAsync<void>;

  /**
   * Wrap the current renderable value.
   *
   * @param props - The renderable composed by the specialization.
   * @returns A wrapped renderable, or a nullish value to gate rendering.
   */
  ui(this: HookContext<PluginName>, props: {children: Renderable}): Renderable;

  /** Initialize after service registration has completed. */
  initialize(this: HookContext<PluginName>): MaybeAsync<void>;

  /** Start active work owned by the scope. */
  activate(this: HookContext<PluginName>): MaybeAsync<void>;

  /** Pause active work so the scope can later reactivate. */
  deactivate(this: HookContext<PluginName>): MaybeAsync<void>;

  /** Permanently release resources owned by the scope. */
  dispose(this: HookContext<PluginName>): MaybeAsync<void>;

  /**
   * React synchronously to a fatal lifecycle failure.
   *
   * @param error - The normalized fatal error.
   */
  error(this: HookContext<PluginName>, error: ApplicationError): void;
}

/**
 * A plugin that defines the execution strategy for one executable scope.
 *
 * Exactly one kernel belongs to each scope. Its hooks run after the
 * specialization callback for each lifecycle phase.
 */
export interface Kernel<Name extends string = string> extends Plugin<
  KernelLifecycles<Name>,
  Name
> {}

/** The lifecycle state of an executable scope. */
export type ExecutableStatus =
  | 'created'
  | 'creating'
  | 'initializing'
  | 'initialized'
  | 'activating'
  | 'active'
  | 'deactivating'
  | 'inactive'
  | 'disposing'
  | 'disposed'
  | 'error';

/** Events emitted after executable lifecycle transitions settle. */
export interface ExecutableEventMap {
  'executable:initialized': undefined;
  'executable:activated': undefined;
  'executable:deactivated': undefined;
  'executable:disposed': undefined;
  'executable:errored': ApplicationError;
}

/**
 * Behavior injected by an executable specialization.
 *
 * Executable itself never invokes inherited plugins. A specialization uses
 * these callbacks to select the lifecycle family and execution strategy that
 * apply to its plugins. Kernel hooks remain owned by Executable and run after
 * the corresponding callback.
 *
 * @template PluginLifecycles - Hook map exposed by the inherited plugin container.
 */
export interface LifecycleCallbacks<
  PluginLifecycles extends Record<keyof PluginLifecycles, (...args: any[]) => any> =
    KernelLifecycles,
> {
  /** Run specialization-specific creation behavior. */
  create?(this: Executable<PluginLifecycles>): MaybeAsync<void>;

  /**
   * Compose the specialization's renderable synchronously.
   *
   * @param children - The scope's base renderable.
   * @returns The specialization-composed renderable.
   */
  renderable?(this: Executable<PluginLifecycles>, children: Renderable): Renderable;

  /** Run specialization-specific initialization behavior. */
  initialize?(this: Executable<PluginLifecycles>): MaybeAsync<void>;

  /** Run specialization-specific activation behavior. */
  activate?(this: Executable<PluginLifecycles>): MaybeAsync<void>;

  /** Run specialization-specific deactivation behavior. */
  deactivate?(this: Executable<PluginLifecycles>): MaybeAsync<void>;

  /** Run specialization-specific disposal behavior. */
  dispose?(this: Executable<PluginLifecycles>): MaybeAsync<void>;

  /**
   * React synchronously to a fatal lifecycle failure.
   *
   * Errors thrown by this callback are ignored so they cannot replace the
   * original failure.
   *
   * @param error - The normalized fatal error.
   */
  error?(this: Executable<PluginLifecycles>, error: ApplicationError): void;
}

/**
 * Options for constructing an executable scope.
 *
 * @template PluginLifecycles - Hook map exposed by the inherited plugin container.
 */
export interface ExecutableOptions<
  PluginLifecycles extends Record<keyof PluginLifecycles, (...args: any[]) => any> =
    KernelLifecycles,
> {
  /** The kernel that defines this scope's execution strategy. */
  kernel?: Kernel;

  /** Specialization behavior executed before the kernel in each phase. */
  lifecycles?: LifecycleCallbacks<PluginLifecycles>;

  /** Plugins inherited by the specialization and invoked only by its callbacks. */
  plugins?: Plugin<PluginLifecycles>[];

  /** The innermost renderable value for the scope. */
  renderable?: Renderable;

  /**
   * Human-readable local scope segment.
   *
   * Telemetry derives a dot-separated namespace from the parent chain. Root
   * scopes default to `executable`; specializations choose their own defaults.
   */
  scope?: string;

  /** Telemetry configuration for the scope. */
  telemetry?: TelemetryOptions;
}

/**
 * Observable executable state without lifecycle controls.
 *
 * @template PluginLifecycles - Hook map exposed by the inherited plugin container.
 */
export interface ReadonlyExecutable<
  PluginLifecycles extends Record<keyof PluginLifecycles, (...args: any[]) => any> =
    KernelLifecycles,
> extends EventEmitter<ExecutableEventMap> {
  /** The scoped service container. */
  readonly container: ServiceContainer<Services>;

  /** The normalized fatal error, or `null` while healthy. */
  readonly error: ApplicationError | null;

  /** The inherited plugin container controlled by the specialization. */
  readonly pluginContainer: ReadonlyPluginContainer<PluginLifecycles>;

  /** The human-readable local scope segment. */
  readonly scope: string;

  /** The current lifecycle state. */
  readonly status: ExecutableStatus;

  /** The scope's telemetry instance. */
  readonly telemetry: Telemetry;

  /** The fully composed renderable value. */
  readonly ui: ReadonlySignal<Renderable>;
}

/**
 * A scope with explicit executable lifecycle control.
 *
 * @template PluginLifecycles - Hook map exposed by the inherited plugin container.
 */
export interface Executable<
  PluginLifecycles extends Record<keyof PluginLifecycles, (...args: any[]) => any> =
    KernelLifecycles,
> extends ReadonlyExecutable<PluginLifecycles> {
  /** Advance a newly created scope through creation and initialization. */
  initialize(): Promise<this>;

  /** Activate an initialized or inactive scope, initializing it when needed. */
  activate(): Promise<this>;

  /** Deactivate an active scope. Calls in other nonterminal states are no-ops. */
  deactivate(): Promise<this>;

  /**
   * Permanently dispose the scope and its owned infrastructure.
   *
   * @throws When the scope is already disposed or has fatally failed.
   */
  dispose(): Promise<this>;
}
