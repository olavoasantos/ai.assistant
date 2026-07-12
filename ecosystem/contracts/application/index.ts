import type {IntentQuery, ServiceProviderLifecycles as ExtendedServiceProviderLifecycles} from '..';
import type {
  Executable,
  ExecutableOptions,
  ExecutableStatus,
  KernelLifecycles as ExecutableKernelLifecycles,
  ReadonlyExecutable,
} from '../executable';
import type {ApplicationError} from '../error';
import type {Intent, IntentDefinition, IntentRegistry, IntentSystemOptions} from '../intents';
import type {HookContext, Plugin, ReadonlyPluginContainer} from '../plugins';
import type {Renderable} from '../renderable';
import type {MaybeAsync} from '../utilities';

export type {Kernel, KernelLifecycles} from '../executable';

/** The lifecycle state of an application scope. */
export type ApplicationStatus = ExecutableStatus;

/**
 * Lifecycle hooks available to application service providers.
 *
 * Ordinary hooks apply to the unique application root. Activity hooks apply
 * only when the provider is inherited by an activity. Resolution hooks allow
 * the intent registry to involve providers without coupling it to domains.
 *
 * @template PluginName - Literal provider name used for typed context state.
 */
export interface ServiceProviderLifecycles<PluginName extends string = string>
  extends ExecutableKernelLifecycles<PluginName>, ExtendedServiceProviderLifecycles<PluginName> {
  /** Register services and bindings for an activity scope. */
  createActivity(this: HookContext<PluginName>): MaybeAsync<void>;

  /**
   * Wrap an activity's visual representation.
   *
   * @param props - The renderable composed by earlier providers.
   * @returns The provider-composed renderable.
   */
  uiActivity(this: HookContext<PluginName>, props: {children: Renderable}): Renderable;

  /** Initialize after activity registrations complete. */
  initializeActivity(this: HookContext<PluginName>): MaybeAsync<void>;

  /** Start active work for an activity. */
  activateActivity(this: HookContext<PluginName>): MaybeAsync<void>;

  /** Pause active work for an activity. */
  deactivateActivity(this: HookContext<PluginName>): MaybeAsync<void>;

  /** Release resources associated with an activity. */
  disposeActivity(this: HookContext<PluginName>): MaybeAsync<void>;

  /**
   * React synchronously to a fatal activity failure.
   *
   * @param error - The normalized fatal error.
   */
  errorActivity(this: HookContext<PluginName>, error: ApplicationError): void;

  /**
   * Lazily contribute intent definitions for a query.
   *
   * @param query - The intent query being resolved.
   * @returns Intent definitions to register, or void to opt out.
   */
  resolve(this: HookContext<PluginName>, query: IntentQuery): MaybeAsync<IntentDefinition[] | void>;

  /**
   * Participate in matching an intent against a query.
   *
   * Returning `false` vetoes an immutable-field match. Returning `true` or
   * `void` cannot expand matching beyond immutable fields.
   */
  match(this: HookContext<PluginName>, query: IntentQuery, intent: Intent): boolean | void;

  /**
   * Choose one candidate when immutable matching remains ambiguous.
   *
   * @param query - The intent query.
   * @param intents - Matching candidates in priority order.
   * @returns The selected intent, or void to defer.
   */
  disambiguate(
    this: HookContext<PluginName>,
    query: IntentQuery,
    intents: readonly Intent[],
  ): Intent | void;
}

/**
 * A plugin that contributes infrastructure to the application and optionally
 * participates in activity and intent behavior.
 */
export interface ServiceProvider<Name extends string = string> extends Plugin<
  ServiceProviderLifecycles<Name>,
  Name
> {}

/** Options for constructing the unique application root. */
export interface ApplicationOptions extends Omit<
  ExecutableOptions<ServiceProviderLifecycles>,
  'lifecycles' | 'plugins'
> {
  /** Service providers inherited by specialized executable children. */
  serviceProviders?: ServiceProvider[];

  /** Intent scopes and definitions available to the application. */
  intents?: IntentSystemOptions;
}

/** Observable application state without lifecycle controls. */
export interface ReadonlyApplication extends Omit<
  ReadonlyExecutable<ServiceProviderLifecycles>,
  'pluginContainer'
> {
  /** The application's intent registry. */
  readonly intents: IntentRegistry;

  /** The container managing application service providers. */
  readonly pluginContainer: ReadonlyPluginContainer<ServiceProviderLifecycles>;
}

/** The unique root orchestration scope for a running system. */
export interface Application
  extends
    Omit<Executable<ServiceProviderLifecycles>, keyof ReadonlyApplication>,
    ReadonlyApplication {}
