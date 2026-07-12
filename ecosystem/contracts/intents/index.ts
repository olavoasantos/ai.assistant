/**
 * Intent system types.
 *
 * Defines the definition-resolution-invocation system for scoped
 * execution contexts. Intents are declarative definitions of executable
 * units of work. Activities are runtime instances of intents — scoped
 * application contexts with their own lifecycle, service container, and
 * visual representation. The intent registry manages registration,
 * resolution, matching, disambiguation, and invocation.
 */
import type {ApplicationError} from '../error';
import type {EventEmitter} from '../events';
import type {IntentMetadata, IntentQuery, Services} from '..';
import type {Renderable} from '../renderable';
import type {ReadonlyServiceContainer} from '../service-container';
import type {Telemetry} from '../telemetry';
import type {MaybeAsync} from '../utilities';
import type {Rule} from '../validation';
import type {Application, Kernel, ServiceProvider, ServiceProviderLifecycles} from '../application';
import type {Executable, ReadonlyExecutable} from '../executable';

export type {IntentQuery} from '..';

/**
 * The execution mode of an activity.
 *
 * - `'awaitable'` — triggers, executes, returns a single result, then
 *   terminates. The consumer awaits `activity.response` as a
 *   `Promise<ActivityResponse<T>>`.
 * - `'streaming'` — triggers, produces results over time, eventually
 *   terminates. The consumer iterates `activity.response` as an
 *   `AsyncIterable<ActivityResponse<T>>`.
 * - `'detached'` — triggers and executes out-of-band. No response
 *   mechanism. `activity.response` is `undefined`.
 */
export type ActivityMode = 'awaitable' | 'streaming' | 'detached';

/**
 * Discriminant for an {@link ActivityResponse} envelope.
 *
 * - `'success'` — the handler completed successfully.
 * - `'error'` — the handler encountered an application-level error.
 * - `'cancelled'` — the activity was cancelled before completion.
 */
export type ActivityResponseStatus = 'success' | 'error' | 'cancelled';

/** Successful activity response containing handler output. */
export interface SuccessActivityResponse<T = unknown> {
  status: 'success';
  data: T;
  error?: never;
}

/** Activity response containing an application-level failure. */
export interface ErrorActivityResponse {
  status: 'error';
  data?: never;
  error: ApplicationError;
}

/** Activity response indicating cancellation before completion. */
export interface CancelledActivityResponse {
  status: 'cancelled';
  data?: never;
  error?: never;
}

/**
 * Structured response envelope returned by an activity.
 *
 * Discriminated on {@link ActivityResponseStatus}. Application-level
 * errors resolve the response (they do not reject the promise). Promise
 * rejection is reserved for infrastructure failures.
 *
 * @template T - The type of the success payload.
 */
export type ActivityResponse<T = unknown> =
  | SuccessActivityResponse<T>
  | ErrorActivityResponse
  | CancelledActivityResponse;

/**
 * The consumer-facing response shape, determined by the activity mode.
 *
 * - Awaitable activities expose a `Promise<ActivityResponse<T>>`.
 * - Streaming activities expose an `AsyncIterable<ActivityResponse<T>>`.
 * - Detached activities expose `undefined` (no response mechanism).
 *
 * @template T - The type of the success payload.
 */
export type ActivityResponseType<T = unknown> =
  | Promise<ActivityResponse<T>>
  | AsyncIterable<ActivityResponse<T>>
  | undefined;

/**
 * The handler-facing response API exposed as `activity.respond`.
 *
 * Provides methods for sending structured responses back to the
 * consumer. Behavior varies by activity mode:
 *
 * - **Awaitable:** `success`/`error`/`cancelled`/`send` resolve the
 *   response promise. `complete(data?)` aliases `success`.
 *   Double-respond throws.
 * - **Streaming:** `success`/`error`/`send` yield to the async
 *   iterator. `complete()` terminates it.
 * - **Detached:** All respond methods throw.
 *
 * @template T - The type of the success payload.
 */
export interface ActivityResponder<T = unknown> {
  /**
   * Sends a success response with the given data.
   *
   * @param data - The success payload.
   */
  success(data: T): void;

  /**
   * Sends an error response.
   *
   * @param error - The application error to send.
   */
  error(error: ApplicationError): void;

  /** Sends a cancelled response. */
  cancelled(): void;

  /**
   * Sends a raw response envelope.
   *
   * @param response - The complete response envelope to send.
   */
  send(response: ActivityResponse<T>): void;

  /**
   * Completes the activity.
   *
   * In awaitable mode, aliases `success(data)`. In streaming mode,
   * optionally sends a final success entry then terminates the async
   * iterator.
   *
   * @param data - Optional success payload for the final response.
   */
  complete(data?: T): void;
}

/**
 * Context object passed to an intent handler during execution.
 *
 * @template Input - The validated input type for this intent.
 */
export interface IntentHandlerContext<Input = unknown> {
  /** The activity instance executing this handler. */
  activity: Activity;

  /** The scoped service container for resolving dependencies. */
  container: ReadonlyServiceContainer<Services>;

  /** The scoped telemetry instance for instrumentation. */
  telemetry: Telemetry;

  /** The validated input data for this invocation. */
  input: Input;

  /**
   * Updates the activity's visual representation.
   *
   * @param renderable - The new renderable to display.
   */
  render: (renderable: Renderable) => void;
}

/**
 * The handler function that executes an intent's work.
 *
 * @template Input - The validated input type for this intent.
 */
export type IntentHandler<Input = unknown> = (
  context: IntentHandlerContext<Input>,
) => MaybeAsync<void>;

/**
 * Options for invoking an intent.
 *
 * Identical to {@link IntentQuery} minus the identity fields (action
 * and mimeType), which are already known from the query or intent.
 */
export type IntentInvokeOptions = Omit<IntentQuery, 'action' | 'mimeType'>;

/**
 * The subset of intent fields that can be mutated after registration.
 *
 * Passed to {@link Intent.setMany} to update one or more mutable fields
 * in a single call. Map-like fields (metadata) are shallow-merged;
 * scalar fields are replaced.
 *
 * @template Input - The expected input type for the handler.
 * @template Output - The expected output type for response validation.
 */
export interface IntentMutableFields<Input = unknown, Output = unknown> {
  /** Human-readable name for the intent. */
  name?: string;

  /** Description of the intent's purpose. */
  description?: string;

  /** The handler function that executes the intent's work. */
  handler?: IntentHandler<Input>;

  /**
   * Validation rule for input data.
   *
   * When present, input is validated against this rule before the
   * handler executes. Validation failure prevents execution.
   */
  inputSchema?: Rule<unknown, Input>;

  /**
   * Validation rule for response data.
   *
   * When present, success response data is validated against this
   * rule before being sent to the consumer.
   */
  outputSchema?: Rule<unknown, Output>;

  /** Extensible metadata bag. Shallow-merged on update. */
  metadata?: IntentMetadata;

  /**
   * The execution mode for activities spawned by this intent.
   *
   * @defaultValue `'awaitable'`
   */
  mode?: ActivityMode;

  /**
   * Numeric priority for disambiguation.
   *
   * Higher values win during disambiguation when multiple intents match.
   */
  priority?: number;
}

/**
 * Configuration options for registering an intent.
 *
 * Combines identity fields (immutable after registration) with mutable
 * fields. The identity tuple — `action + mimeType + scope + kernel +
 * vendor` — uniquely identifies an intent.
 *
 * @template Input - The expected input type for the handler.
 * @template Output - The expected output type for response validation.
 */
export interface IntentDefinition<Input = unknown, Output = unknown> extends IntentMutableFields<
  Input,
  Output
> {
  /**
   * The action verb (e.g. `'create'`, `'navigate'`, `'handle'`).
   *
   * Part of the immutable identity tuple.
   */
  action: string;

  /**
   * The subject MIME type (e.g. `'application/vnd.ai.assistant.thing'`).
   *
   * Part of the immutable identity tuple.
   */
  mimeType: string;

  /**
   * The execution template scope name.
   *
   * Must reference a scope declared in the application's scope
   * definitions. Part of the immutable identity tuple.
   */
  scope: string;

  /**
   * The kernel name within the scope.
   *
   * Must reference a kernel declared in the scope's kernel list.
   * Part of the immutable identity tuple.
   */
  kernel: string;

  /**
   * The vendor or developer identifier.
   *
   * Part of the immutable identity tuple. Defaults to an empty
   * string when omitted.
   */
  vendor?: string;

  /** The handler function. Required for registration. */
  handler: IntentHandler<Input>;
}

/**
 * A registered intent — a readonly view of a declarative unit of work.
 *
 * Symbol-branded via `Symbol.for('ai.assistant:Intent')`.
 *
 * @template Input - The expected input type for the handler.
 * @template Output - The expected output type for response validation.
 */
export interface Intent<Input = unknown, Output = unknown> {
  readonly action: string;
  readonly mimeType: string;
  readonly scope: string;
  readonly kernel: string;
  readonly vendor: string;
  readonly name: string | undefined;
  readonly description: string | undefined;
  readonly handler: IntentHandler<Input>;
  readonly mode: ActivityMode;
  readonly priority: number;
  readonly metadata: IntentMetadata;
  readonly activities: readonly Activity[];

  /**
   * Root-level shortcut invocation that bypasses resolution and disambiguation.
   *
   * Because registered intents are shared by all registry views, direct
   * invocation is parented to the application rather than a current activity.
   * Use `activity.intents.invoke()` to create a nested activity.
   *
   * @param options - Invocation options including optional input data.
   * @returns A promise resolving to the created activity.
   */
  invoke(options?: IntentInvokeOptions): Promise<Activity>;

  /**
   * Updates one or more mutable fields in a single call.
   *
   * @param updates - Partial set of mutable fields to update.
   * @returns This intent for fluent chaining.
   */
  setMany(updates: IntentMutableFields<Input, Output>): this;
}

/**
 * Read-only view of an activity instance.
 *
 * Exposes inspection properties without lifecycle control or the
 * handler-facing response API.
 *
 * @template Input - The validated input type.
 * @template Output - The response data type.
 */
export interface ReadonlyActivity<
  Input = unknown,
  Output = unknown,
> extends ReadonlyExecutable<ServiceProviderLifecycles> {
  /** The registered intent that created this activity. */
  readonly intent: Intent<Input, Output>;

  /** The containing activity, or `undefined` for a root activity. */
  readonly parent: Activity | undefined;

  /** Direct child activities created from this activity. */
  readonly children: readonly Activity[];

  /** The unique application root. */
  readonly app: Application;

  /** Registry view whose invocations create child activities. */
  readonly intents: IntentRegistry;

  /** The response behavior selected by the intent. */
  readonly mode: ActivityMode;

  /** The validated invocation input. */
  readonly input: Input;

  /** The consumer-facing response channel. */
  readonly response: ActivityResponseType<Output>;
}

/**
 * A runtime instance of an intent — a scoped execution context.
 *
 * Extends {@link ReadonlyActivity} with the handler-facing response
 * API and full lifecycle control.
 *
 * Symbol-branded via `Symbol.for('ai.assistant:Activity')`.
 *
 * @template Input - The validated input type.
 * @template Output - The response data type.
 */
export interface Activity<Input = unknown, Output = unknown>
  extends ReadonlyActivity<Input, Output>, Executable<ServiceProviderLifecycles> {
  /** The handler-facing response API. */
  readonly respond: ActivityResponder<Output>;
}

/**
 * Extensible event map for intent registry events.
 */
export interface IntentRegistryEventMap {}

/**
 * Read-only view of the intent registry.
 *
 * Exposes resolution and inspection methods without registration or
 * invocation capability.
 */
export interface ReadonlyIntentRegistry {
  get(query: IntentQuery): Intent | undefined;
  get(uri: string): Intent | undefined;
  get(uri: string, options: IntentInvokeOptions): Intent | undefined;
  get(queryOrUri: IntentQuery | string, options?: IntentInvokeOptions): Intent | undefined;

  getAll(query: IntentQuery): Intent[];
  getAll(uri: string): Intent[];
  getAll(uri: string, options: IntentInvokeOptions): Intent[];
  getAll(queryOrUri: IntentQuery | string, options?: IntentInvokeOptions): Intent[];

  ensure(query: IntentQuery): Intent;
  ensure(uri: string): Intent;
  ensure(uri: string, options: IntentInvokeOptions): Intent;
  ensure(queryOrUri: IntentQuery | string, options?: IntentInvokeOptions): Intent;

  ensureAll(query: IntentQuery): Intent[];
  ensureAll(uri: string): Intent[];
  ensureAll(uri: string, options: IntentInvokeOptions): Intent[];
  ensureAll(queryOrUri: IntentQuery | string, options?: IntentInvokeOptions): Intent[];

  resolve(query: IntentQuery): Promise<Intent | undefined>;
  resolve(uri: string): Promise<Intent | undefined>;
  resolve(uri: string, options: IntentInvokeOptions): Promise<Intent | undefined>;
  resolve(
    queryOrUri: IntentQuery | string,
    options?: IntentInvokeOptions,
  ): Promise<Intent | undefined>;

  resolveAll(query: IntentQuery): Promise<Intent[]>;
  resolveAll(uri: string): Promise<Intent[]>;
  resolveAll(uri: string, options: IntentInvokeOptions): Promise<Intent[]>;
  resolveAll(queryOrUri: IntentQuery | string, options?: IntentInvokeOptions): Promise<Intent[]>;

  require(query: IntentQuery): Promise<Intent>;
  require(uri: string): Promise<Intent>;
  require(uri: string, options: IntentInvokeOptions): Promise<Intent>;
  require(queryOrUri: IntentQuery | string, options?: IntentInvokeOptions): Promise<Intent>;

  requireAll(query: IntentQuery): Promise<Intent[]>;
  requireAll(uri: string): Promise<Intent[]>;
  requireAll(uri: string, options: IntentInvokeOptions): Promise<Intent[]>;
  requireAll(queryOrUri: IntentQuery | string, options?: IntentInvokeOptions): Promise<Intent[]>;

  readonly size: number;
  readonly isEmpty: boolean;
  [Symbol.iterator](): IterableIterator<Intent>;
}

/**
 * The intent registry — manages registration, resolution, and invocation.
 *
 * Shared across the activity tree rooted at the application. Registration happens at the root.
 * Invocation from a child resolves via the root but associates the new
 * activity as a child of the calling context.
 */
export interface IntentRegistry
  extends ReadonlyIntentRegistry, EventEmitter<IntentRegistryEventMap> {
  /**
   * Registers an intent from a definition.
   *
   * Validates against known scope templates. The identity tuple is
   * unique — registering the same tuple again merges mutable fields.
   *
   * @param definition - The intent definition to register.
   * @returns The created or updated intent.
   * @throws When the scope+kernel combination is not declared.
   */
  register(definition: IntentDefinition): Intent;

  invoke(query: IntentQuery, options?: IntentInvokeOptions): Promise<Activity>;
  invoke(uri: string, options?: IntentInvokeOptions): Promise<Activity>;
  invoke(queryOrUri: IntentQuery | string, options?: IntentInvokeOptions): Promise<Activity>;

  invokeAll(query: IntentQuery, options?: IntentInvokeOptions): Promise<Activity[]>;
  invokeAll(uri: string, options?: IntentInvokeOptions): Promise<Activity[]>;
  invokeAll(queryOrUri: IntentQuery | string, options?: IntentInvokeOptions): Promise<Activity[]>;
}

/**
 * Declaration of an execution scope.
 *
 * Expanded into {@link ScopeTemplate} instances — one per scope×kernel
 * combination. Intent registration validates against known templates.
 */
export interface ScopeDefinition {
  /** Name used by intent definitions to select this execution scope. */
  scope: string;

  /** Kernels available for activities in this scope. */
  kernels: Kernel[];

  /** Additional providers inherited only by activities in this scope. */
  serviceProviders?: ServiceProvider[];
}

/**
 * An expanded scope×kernel execution recipe.
 *
 * Created internally by expanding each {@link ScopeDefinition}.
 */
export interface ScopeTemplate {
  /** Scope name from the source definition. */
  scope: string;

  /** Kernel selected by an intent definition. */
  kernel: Kernel;

  /** Activity-specific providers added to inherited application providers. */
  serviceProviders: ServiceProvider[];
}

/**
 * Configuration for the intent system within application options.
 */
export interface IntentSystemOptions {
  /** Static execution scopes available to registered intents. */
  scopes?: ScopeDefinition[];

  /** Intent definitions registered eagerly during application construction. */
  definitions?: IntentDefinition[];
}
