/**
 * Contracts for lifecycle-controlled executable scopes.
 *
 * An executable coordinates scoped services, plugins, telemetry, rendering,
 * lifecycle transitions, and child scopes without defining domain behavior.
 */
import type {Services, KernelLifecycles as ExtendedKernelLifecycles} from '..';
import type {ApplicationError} from '../error';
import type {EventEmitter} from '../events';
import type {HookContext, Plugin, ReadonlyPluginContainer} from '../plugins';
import type {Renderable} from '../renderable';
import type {ServiceContainer} from '../service-container';
import type {ReadonlySignal} from '../signals';
import type {Telemetry, TelemetryOptions} from '../telemetry';
import type {MaybeAsync} from '../utilities';

/**
 * Lifecycle hooks implemented by executable plugins and kernels.
 *
 * @template PluginName - Literal plugin name used for typed context state.
 */
export interface KernelLifecycles<
  PluginName extends string = string,
> extends ExtendedKernelLifecycles {
  /** Register services and bindings for the executable scope. */
  create(this: HookContext<PluginName>): MaybeAsync<void>;

  /**
   * Wrap the current renderable value.
   *
   * @param props - The renderable composed by earlier layers.
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
 * Exactly one kernel belongs to each scope. It runs after ordinary plugins
 * for each lifecycle phase and wraps their composed renderable outermost.
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
 * Optional behavior injected into executable lifecycle phases.
 *
 * Callbacks run with the executable as `this`, before ordinary plugins and
 * the kernel for the corresponding phase.
 */
export interface LifecycleCallbacks {
  /** Register scope-specific services and bindings. */
  create?(this: Executable): MaybeAsync<void>;

  /**
   * Transform the base renderable before plugin and kernel wrappers.
   *
   * @param children - The scope's base renderable.
   * @returns The transformed renderable, or a nullish value to gate rendering.
   */
  renderable?(this: Executable, children: Renderable): Renderable;

  /** Initialize scope-specific behavior. */
  initialize?(this: Executable): MaybeAsync<void>;

  /** Start scope-specific active work. */
  activate?(this: Executable): MaybeAsync<void>;

  /** Pause scope-specific active work. */
  deactivate?(this: Executable): MaybeAsync<void>;

  /** Permanently release scope-specific resources. */
  dispose?(this: Executable): MaybeAsync<void>;

  /**
   * React synchronously to a fatal lifecycle failure.
   *
   * Errors thrown by this callback are ignored so they cannot replace the
   * original failure.
   *
   * @param error - The normalized fatal error.
   */
  error?(this: Executable, error: ApplicationError): void;
}

/** Options for constructing or forking an executable scope. */
export interface ExecutableOptions {
  /** The kernel that defines the scope's execution strategy. */
  kernel?: Kernel;

  /** Lifecycle behavior injected by a specialization. */
  lifecycles?: LifecycleCallbacks;

  /** Ordinary plugins orchestrated before the kernel. */
  plugins?: Plugin<KernelLifecycles>[];

  /** The innermost renderable value for the scope. */
  renderable?: Renderable;

  /**
   * Human-readable local scope segment.
   *
   * Telemetry derives a dot-separated namespace from the fork chain.
   * Root scopes default to `executable`; forked scopes default to `child`.
   */
  scope?: string;

  /** Telemetry configuration for the scope. */
  telemetry?: TelemetryOptions;
}

/**
 * Observable view of an executable scope without lifecycle controls.
 *
 * Infrastructure objects remain operational because plugins and consumers
 * resolve services and observe telemetry through this view; lifecycle state
 * itself can only be changed through {@link Executable} methods.
 */
export interface ReadonlyExecutable extends EventEmitter<ExecutableEventMap> {
  /** The scoped service container. */
  readonly container: ServiceContainer<Services>;

  /** The normalized fatal error, or `null` while the scope is healthy. */
  readonly error: ApplicationError | null;

  /** The ordinary plugin container for the scope. */
  readonly pluginContainer: ReadonlyPluginContainer<KernelLifecycles>;

  /** The human-readable local scope segment. */
  readonly scope: string;

  /** The current lifecycle state. */
  readonly status: ExecutableStatus;

  /** The scope's telemetry instance. */
  readonly telemetry: Telemetry;

  /** The fully composed renderable value. */
  readonly ui: ReadonlySignal<Renderable>;
}

/** A scope with explicit executable lifecycle control. */
export interface Executable extends ReadonlyExecutable {
  /**
   * Advance a newly created scope through creation and initialization.
   *
   * Repeated calls after initialization are no-ops.
   *
   * @returns This scope after the transition settles.
   */
  initialize(): Promise<this>;

  /**
   * Activate an initialized or inactive scope, initializing it first when
   * necessary. Repeated calls while active are no-ops.
   *
   * @returns This scope after the transition settles.
   */
  activate(): Promise<this>;

  /**
   * Deactivate an active scope. Calls in other nonterminal states are no-ops.
   *
   * @returns This scope after the transition settles.
   */
  deactivate(): Promise<this>;

  /**
   * Permanently dispose the scope and its owned infrastructure.
   *
   * @returns This scope after disposal settles.
   * @throws When the scope is already disposed or has fatally failed.
   */
  dispose(): Promise<this>;

  /**
   * Create an independently controlled child scope.
   *
   * @param options - Child-specific plugins, kernel, lifecycle behavior, and scope settings.
   * @returns A child at `created` state.
   * @throws When the parent is disposed or has fatally failed.
   */
  fork(options?: ExecutableOptions): Executable;
}
