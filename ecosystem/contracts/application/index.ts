import type {
  Executable,
  ExecutableOptions,
  ExecutableStatus,
  KernelLifecycles as ExecutableKernelLifecycles,
  ReadonlyExecutable,
} from '../executable';
import type {Plugin, ReadonlyPluginContainer} from '../plugins';

export type {Kernel, KernelLifecycles} from '../executable';

/** The lifecycle state of an application scope. */
export type ApplicationStatus = ExecutableStatus;

/**
 * Lifecycle hooks available to application service providers.
 *
 * Providers register services during creation, initialize and control their
 * resources with the application, and may wrap its renderable value.
 *
 * @template PluginName - Literal provider name used for typed context state.
 */
export interface ServiceProviderLifecycles<
  PluginName extends string = string,
> extends ExecutableKernelLifecycles<PluginName> {}

/**
 * A plugin that contributes infrastructure to an application scope.
 *
 * @template Name - Literal provider name used for ordering and typed state.
 */
export interface ServiceProvider<Name extends string = string> extends Plugin<
  ServiceProviderLifecycles<Name>,
  Name
> {}

/** Options for constructing or forking an application scope. */
export interface ApplicationOptions extends Omit<ExecutableOptions, 'lifecycles' | 'plugins'> {
  /** Service providers orchestrated before the application kernel. */
  serviceProviders?: ServiceProvider[];
}

/** Observable application state without lifecycle controls. */
export interface ReadonlyApplication extends Omit<ReadonlyExecutable, 'pluginContainer'> {
  /** The container that manages this scope's service providers. */
  readonly pluginContainer: ReadonlyPluginContainer<ServiceProviderLifecycles>;
}

/** The root orchestration scope for a running system. */
export interface Application
  extends Omit<Executable, keyof ReadonlyApplication | 'fork'>, ReadonlyApplication {
  /**
   * Create an independently controlled child application scope.
   *
   * @param options - Child-specific providers, kernel, rendering, and scope settings.
   * @returns A child application at `created` state.
   * @throws When the parent is disposed or has fatally failed.
   */
  fork(options?: ApplicationOptions): Application;
}
