import type {
  Application as ApplicationContract,
  ServiceProviderLifecycles,
} from '@ai.assistant/contracts/application';
import type {
  Activity,
  ActivityMode,
  ActivityResponder,
  ActivityResponse,
  ActivityResponseType,
  IntentDefinition,
  IntentInvokeOptions,
  Intent as IntentContract,
  ScopeDefinition,
} from '@ai.assistant/contracts/intents';
import type {Plugin, ReadonlyPluginContainer} from '@ai.assistant/contracts/plugins';
import type {Rule} from '@ai.assistant/contracts/validation';
import type {Executable} from '@ai.assistant/executable';
import type {Intent} from '../classes/Intent';
import type {IntentRegistry} from '../classes/IntentRegistry';

/** Delegates direct intent invocation to its owning registry. */
export interface IntentInvokeCallback {
  <Input, Output>(
    intent: IntentContract<Input, Output>,
    options?: IntentInvokeOptions,
  ): Promise<Activity>;
}

/** Deferred response state used by awaitable activities. */
export interface DeferredActivityResponse<T> {
  promise: Promise<ActivityResponse<T>>;
  resolve(value: ActivityResponse<T>): void;
  reject(reason: unknown): void;
}

/** Pending streaming consumer waiting for the next response. */
export interface ActivityResponseWaiter<T> {
  resolve(value: IteratorResult<ActivityResponse<T>>): void;
}

/** Internal controller for an activity response channel. */
export interface ActivityResponseController<T = unknown> {
  readonly respond: ActivityResponder<T>;
  readonly response: ActivityResponseType<T>;
  readonly isComplete: boolean;
  dispose(): void;
}

/** Internal construction options for an activity. */
export interface ActivityConstructorOptions {
  intent: Intent;
  mode: ActivityMode;
  input: unknown;
  parent: Executable<ServiceProviderLifecycles>;
  app: Executable<ServiceProviderLifecycles> & ApplicationContract;
  registry: IntentRegistry;
  kernel: Plugin;
  serviceProviders?: Plugin<ServiceProviderLifecycles>[];
  outputSchema?: Rule<unknown, unknown>;
}

/** Internal construction options for an intent registry. */
export interface IntentRegistryOptions {
  scopes?: ScopeDefinition[];
  definitions?: IntentDefinition[];
  app: Executable<ServiceProviderLifecycles> & ApplicationContract;
  owner?: Executable<ServiceProviderLifecycles>;
  pluginContainer: ReadonlyPluginContainer<ServiceProviderLifecycles>;
}
