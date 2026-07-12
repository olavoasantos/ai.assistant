import type {
  Application as ApplicationContract,
  ApplicationOptions,
  ServiceProviderLifecycles,
} from '@ai.assistant/contracts/application';
import type {ReadonlyPluginContainer} from '@ai.assistant/contracts/plugins';
import {Executable} from '@ai.assistant/executable';
import {IntentRegistry} from '@ai.assistant/intents';
import {APPLICATION_DEFAULT_SCOPE, APPLICATION_IDENTIFIER, APPLICATION_INTENTS} from '../constants';

/**
 * Default root orchestration scope for a running system.
 *
 * Application specializes Executable by invoking ordinary service-provider
 * hooks before its kernel. It owns the unique root intent registry and is not
 * forkable; specialized executable children choose their own provider lifecycle
 * family.
 */
export class Application
  extends Executable<ServiceProviderLifecycles>
  implements ApplicationContract
{
  /** Symbol brand for cross-boundary identity checks. */
  readonly [APPLICATION_IDENTIFIER] = true as const;

  /** @internal Root intent registry. */
  readonly [APPLICATION_INTENTS]: IntentRegistry;

  /** The application's intent registry. */
  get intents(): IntentRegistry {
    return this[APPLICATION_INTENTS];
  }

  /**
   * Construct the unique inert application root at `created` state.
   *
   * @param options - Application infrastructure, providers, and intents.
   */
  constructor(options: ApplicationOptions = {}) {
    super({
      kernel: options.kernel,
      plugins: options.serviceProviders,
      renderable: options.renderable,
      scope: options.scope ?? APPLICATION_DEFAULT_SCOPE,
      telemetry: options.telemetry,
      lifecycles: {
        async create() {
          await this.pluginContainer.parallel({hook: 'create', args: []});
        },
        renderable(children) {
          return this.pluginContainer.renderable({hook: 'ui', args: [{children}]});
        },
        async initialize() {
          await this.pluginContainer.sequential({hook: 'initialize', args: []});
        },
        async activate() {
          await this.pluginContainer.parallel({hook: 'activate', args: []});
        },
        async deactivate() {
          await this.pluginContainer.parallel({hook: 'deactivate', args: []});
        },
        async dispose() {
          await this.pluginContainer.parallel({hook: 'dispose', args: []});
        },
        error(error) {
          try {
            this.pluginContainer.sequentialSync({hook: 'error', args: [error]});
          } catch {
            // Provider error hooks cannot replace the original failure.
          }
        },
      },
    });

    this[APPLICATION_INTENTS] = new IntentRegistry({
      app: this,
      definitions: options.intents?.definitions,
      pluginContainer: this.pluginContainer,
      scopes: options.intents?.scopes,
    });
    this.addChild(this[APPLICATION_INTENTS]);
  }

  /** The container managing application service providers. */
  override get pluginContainer(): ReadonlyPluginContainer<ServiceProviderLifecycles> {
    return super.pluginContainer;
  }
}
