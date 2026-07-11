import type {
  Application as ApplicationContract,
  ApplicationOptions,
  ServiceProviderLifecycles,
} from '@ai.assistant/contracts/application';
import type {ReadonlyPluginContainer} from '@ai.assistant/contracts/plugins';
import {Executable} from '@ai.assistant/executable';
import {APPLICATION_DEFAULT_SCOPE, APPLICATION_IDENTIFIER} from '../constants';

/**
 * Default root orchestration scope for a running system.
 *
 * Application specializes {@link Executable} by naming ordinary plugins as
 * service providers, applying the `app` root scope default, and preserving the
 * application subtype across factories and forks.
 *
 * @example
 * ```ts
 * const application = await Application.activate({
 *   serviceProviders: [configurationProvider],
 *   kernel: workerKernel,
 * });
 * ```
 */
export class Application extends Executable implements ApplicationContract {
  /**
   * Construct and initialize an application.
   *
   * @param options - Application infrastructure and service providers.
   * @returns An application at `initialized` state.
   */
  static override async create(options?: ApplicationOptions): Promise<Application> {
    const application = new Application(options);
    await application.initialize();
    return application;
  }

  /**
   * Construct, initialize, and activate an application.
   *
   * @param options - Application infrastructure and service providers.
   * @returns An application at `active` state.
   */
  static override async activate(options?: ApplicationOptions): Promise<Application> {
    const application = new Application(options);
    await application.activate();
    return application;
  }

  /** Symbol brand for cross-boundary identity checks. */
  readonly [APPLICATION_IDENTIFIER] = true as const;

  /**
   * Construct an inert application at `created` state.
   *
   * @param options - Application infrastructure and service providers.
   * @param parent - Parent application used internally by {@link fork}.
   */
  constructor(options: ApplicationOptions = {}, parent?: Application) {
    super(
      {
        kernel: options.kernel,
        plugins: options.serviceProviders,
        renderable: options.renderable,
        scope: options.scope ?? (parent ? undefined : APPLICATION_DEFAULT_SCOPE),
        telemetry: options.telemetry,
      },
      parent,
    );
  }

  /** The container that manages this scope's service providers. */
  override get pluginContainer(): ReadonlyPluginContainer<ServiceProviderLifecycles> {
    return super.pluginContainer;
  }

  /**
   * Create an independently controlled child application scope.
   *
   * @param options - Child-specific infrastructure and service providers.
   * @returns A child application at `created` state.
   */
  override fork(options: ApplicationOptions = {}): Application {
    this.ensureNotTerminal();
    return new Application(options, this);
  }
}
