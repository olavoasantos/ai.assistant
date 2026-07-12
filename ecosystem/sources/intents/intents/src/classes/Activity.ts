import type {
  Application as ApplicationContract,
  ServiceProviderLifecycles,
} from '@ai.assistant/contracts/application';
import type {
  Activity as ActivityContract,
  ActivityMode,
  ActivityResponder as ActivityResponderContract,
  ActivityResponseType,
  IntentRegistry as IntentRegistryContract,
} from '@ai.assistant/contracts/intents';
import type {Renderable} from '@ai.assistant/contracts/renderable';
import {Executable} from '@ai.assistant/executable';
import {signal, type Signal} from '@preact/signals-core';
import {
  ACTIVITY_APP,
  ACTIVITY_CHILDREN,
  ACTIVITY_IDENTIFIER,
  ACTIVITY_INPUT,
  ACTIVITY_INTENT,
  ACTIVITY_INTENT_REGISTRY,
  ACTIVITY_MODE,
  ACTIVITY_PARENT,
  ACTIVITY_RESPONDER,
  INTENT_ACTIVITIES,
} from '../constants';
import {ActivityGuard} from '../guards/ActivityGuard';
import type {ActivityConstructorOptions} from '../types';
import {ActivityResponder} from './ActivityResponder';
import type {Intent} from './Intent';
import type {IntentRegistry} from './IntentRegistry';

/**
 * Runtime execution scope created from an intent.
 *
 * Activity inherits application providers but invokes only their activity hook
 * family. Its kernel continues to receive the standard executable hooks.
 */
export class Activity extends Executable<ServiceProviderLifecycles> implements ActivityContract {
  /** Symbol brand for cross-boundary identity checks. */
  readonly [ACTIVITY_IDENTIFIER] = true as const;

  /** @internal Intent that created this activity. */
  private [ACTIVITY_INTENT]: Intent;

  /** @internal Response mode selected by the intent. */
  private [ACTIVITY_MODE]: ActivityMode;

  /** @internal Validated invocation input. */
  private [ACTIVITY_INPUT]: unknown;

  /** @internal Containing activity, when nested. */
  private [ACTIVITY_PARENT]: Activity | undefined;

  /** @internal Unique application root. */
  private [ACTIVITY_APP]: ApplicationContract;

  /** @internal Direct child activities. */
  private [ACTIVITY_CHILDREN]: Signal<readonly Activity[]>;

  /** @internal Response channel controller. */
  private [ACTIVITY_RESPONDER]: ActivityResponder;

  /** @internal Registry view scoped to this activity. */
  private [ACTIVITY_INTENT_REGISTRY]: IntentRegistry;

  /**
   * Construct an inert activity from a resolved intent and scope template.
   *
   * @param options - Activity execution and inherited scope configuration.
   */
  constructor(options: ActivityConstructorOptions) {
    super(
      {
        kernel: options.kernel,
        plugins: options.serviceProviders,
        scope: `activity:${options.intent.action}:${options.intent.mimeType}`,
        lifecycles: {
          async create() {
            await this.pluginContainer.parallel({hook: 'createActivity', args: []});
          },
          renderable(children) {
            return this.pluginContainer.renderable({
              hook: 'uiActivity',
              args: [{children}],
            });
          },
          async initialize() {
            await this.pluginContainer.sequential({hook: 'initializeActivity', args: []});
          },
          async activate() {
            await this.pluginContainer.parallel({hook: 'activateActivity', args: []});
          },
          async deactivate() {
            await this.pluginContainer.parallel({hook: 'deactivateActivity', args: []});
          },
          async dispose() {
            await this.pluginContainer.parallel({hook: 'disposeActivity', args: []});
          },
          error(error) {
            try {
              this.pluginContainer.sequentialSync({hook: 'errorActivity', args: [error]});
            } catch {
              // Provider error hooks cannot replace the original failure.
            }
          },
        },
      },
      options.parent,
    );

    this[ACTIVITY_INTENT] = options.intent;
    this[ACTIVITY_MODE] = options.mode;
    this[ACTIVITY_INPUT] = options.input;
    this[ACTIVITY_PARENT] = ActivityGuard.is(options.parent)
      ? (options.parent as Activity)
      : undefined;
    this[ACTIVITY_APP] = options.app;
    this[ACTIVITY_CHILDREN] = signal<readonly Activity[]>([]);
    this[ACTIVITY_RESPONDER] = new ActivityResponder(options.mode, options.outputSchema);
    this[ACTIVITY_INTENT_REGISTRY] = options.registry.scope(this, this.pluginContainer);

    const parent = this[ACTIVITY_PARENT];
    if (parent) {
      parent[ACTIVITY_CHILDREN].value = [...parent[ACTIVITY_CHILDREN].value, this];
    }
    options.intent[INTENT_ACTIVITIES].value = [...options.intent[INTENT_ACTIVITIES].value, this];
  }

  /** The intent that created this activity. */
  get intent(): Intent {
    return this[ACTIVITY_INTENT];
  }

  /** The containing activity, or `undefined` at the root. */
  get parent(): Activity | undefined {
    return this[ACTIVITY_PARENT];
  }

  /** Direct child activities. */
  get children(): readonly Activity[] {
    return this[ACTIVITY_CHILDREN].value;
  }

  /** The unique application root. */
  get app(): ApplicationContract {
    return this[ACTIVITY_APP];
  }

  /** Registry view whose invocations create child activities. */
  get intents(): IntentRegistryContract {
    return this[ACTIVITY_INTENT_REGISTRY];
  }

  /** Response mode selected by the intent. */
  get mode(): ActivityMode {
    return this[ACTIVITY_MODE];
  }

  /** Validated invocation input. */
  get input(): unknown {
    return this[ACTIVITY_INPUT];
  }

  /** Consumer-facing response channel. */
  get response(): ActivityResponseType {
    return this[ACTIVITY_RESPONDER].response;
  }

  /** Handler-facing response methods. */
  get respond(): ActivityResponderContract {
    return this[ACTIVITY_RESPONDER].respond;
  }

  /**
   * Execute the intent handler with validated input and scoped infrastructure.
   *
   * @internal Called by the registry after activation.
   */
  async executeHandler(): Promise<void> {
    const intent = this[ACTIVITY_INTENT];
    const input = intent.inputSchema
      ? intent.inputSchema.ensureParse(this[ACTIVITY_INPUT])
      : this[ACTIVITY_INPUT];

    await intent.handler({
      activity: this,
      container: this.container,
      telemetry: this.telemetry,
      input,
      render: (renderable: Renderable) => this.render(renderable),
    });
  }

  /** Dispose child activities, owned infrastructure, and tracking references. */
  override async dispose(): Promise<this> {
    for (const child of this[ACTIVITY_CHILDREN].value.slice()) {
      await child.dispose();
    }

    try {
      await super.dispose();
    } finally {
      this.cleanup();
    }
    return this;
  }

  /** Remove this activity from parent, intent, and response tracking. */
  private cleanup(): void {
    const parent = this[ACTIVITY_PARENT];
    if (parent) {
      parent[ACTIVITY_CHILDREN].value = parent[ACTIVITY_CHILDREN].value.filter(
        (child) => child !== this,
      );
    }

    const intent = this[ACTIVITY_INTENT];
    intent[INTENT_ACTIVITIES].value = intent[INTENT_ACTIVITIES].value.filter(
      (activity) => activity !== this,
    );
    this[ACTIVITY_RESPONDER].dispose();
  }
}
