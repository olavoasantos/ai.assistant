import type {ApplicationError} from '../error';
import type {HookContext, Plugin, PluginContinuation} from '../plugins';
import type {MaybeAsync} from '../utilities';
import type {
  RpcBudgetUnit,
  RpcCoreBudgetCategory,
  RpcCoreResourceObservations,
  RpcPluginBudget,
  RpcPluginBudgetCategoryDescriptor,
  RpcResourceObservation,
} from './budgets';

/** Whether session establishment requires a compatible peer wire plugin. */
export type RpcWirePluginRequirement = 'required' | 'optional';

/**
 * Compatibility and namespace offer for one wire-affecting RPC plugin.
 *
 * Protocol identifiers are opaque and listed in local preference order.
 * Value and message namespace names are local to the stable plugin identifier;
 * the negotiated session qualifies them before use.
 */
export interface RpcWirePluginDescriptor {
  /** Stable identity shared by compatible implementations on both peers. */
  readonly id: string;

  /** Non-empty opaque protocol identifiers in local preference order. */
  readonly protocols: readonly [string, ...string[]];

  /** Whether absence or incompatibility rejects session establishment. */
  readonly requirement: RpcWirePluginRequirement;

  /** Plugin-local value namespace names claimed by this protocol family. */
  readonly valueNamespaces?: readonly string[];

  /** Plugin-local control-message namespace names claimed by this protocol family. */
  readonly messageNamespaces?: readonly string[];
}

/** Immutable active wire-plugin selection for one established session. */
export interface RpcWirePluginCompatibility {
  /** Stable wire-plugin identity. */
  readonly id: string;

  /** Opaque protocol identifier selected by both peers. */
  readonly protocol: string;

  /** Fully qualified value namespaces active for this session. */
  readonly valueNamespaces: readonly string[];

  /** Fully qualified message namespaces active for this session. */
  readonly messageNamespaces: readonly string[];
}

/**
 * Consumer-defined metadata carried by one ordinary RPC plugin object.
 *
 * @template ResourceCategory - Plugin-local declared resource category names.
 */
export interface RpcPluginMetadata<ResourceCategory extends string = string> {
  /** Wire compatibility offer; omission makes the plugin local-only. */
  readonly wire?: RpcWirePluginDescriptor;

  /**
   * Finite plugin-local resource categories available during session setup.
   *
   * Wire-plugin categories participate in compatibility under the stable wire
   * identity. Descriptor-free plugin categories remain local to the plugin name.
   */
  readonly resources?: readonly RpcPluginBudgetCategoryDescriptor<ResourceCategory>[];
}

/** Plugin-qualified semantic representation of one serialized value. */
export interface RpcSerializedValue<Payload = unknown> {
  /** Stable wire-plugin identity that owns this representation. */
  readonly plugin: string;

  /** Plugin-local value namespace selected for the representation. */
  readonly namespace: string;

  /** Bounded, recursively serialized plugin payload. */
  readonly payload: Payload;
}

/** Successful hydration result, wrapped to preserve a hydrated `undefined`. */
export interface RpcHydratedValue<Value = unknown> {
  /** Hydrated local value, including a legitimate JavaScript `undefined`. */
  readonly value: Value;
}

/** Core lifecycle category of an authority-bearing serialized reference. */
export type RpcReferenceKind = 'object' | 'function' | 'promise' | 'stream' | 'plugin';

/** Options for issuing one authority-bearing value through a plugin envelope. */
export interface RpcReferenceIssueOptions<Payload = unknown> {
  /** Reference lifecycle category. */
  readonly kind: RpcReferenceKind;

  /** Plugin-local value namespace for the issued representation. */
  readonly namespace: string;

  /** Safe initial body serialized with the reference. */
  readonly payload: Payload;
}

/** Capability for recursively serializing nested values. */
export interface RpcValueSerializer {
  /**
   * Serializes a nested value through core and negotiated value plugins.
   *
   * @param value - Nested owner-side value.
   * @returns Its semantic serialized representation.
   */
  (value: unknown): unknown;
}

/** Capability for issuing authority through the current session. */
export interface RpcReferenceIssuer {
  /**
   * Issues or reuses a session-scoped reference for an owner-side value.
   *
   * Authority commits only if delivery of the containing value succeeds.
   *
   * @param value - Identity-bearing owner-side value.
   * @param options - Reference kind and plugin representation.
   * @returns A plugin-qualified serialized reference envelope.
   */
  (value: object, options: RpcReferenceIssueOptions): RpcSerializedValue;
}

/** Least-capability input for top-down value matching and serialization. */
export interface RpcSerializeValueContext {
  /** Owner-side value being inspected. */
  readonly value: unknown;

  /** Recursively serializes one nested value. */
  readonly serialize: RpcValueSerializer;

  /** Issues session authority for an identity-bearing value. */
  readonly issueReference: RpcReferenceIssuer;
}

/** Capability for recursively hydrating nested serialized values. */
export interface RpcValueHydrator {
  /**
   * Hydrates a nested semantic representation.
   *
   * @param value - Nested serialized representation.
   * @returns Its local hydrated value.
   */
  (value: unknown): unknown;
}

/** Options for creating or updating one hydrated reference identity. */
export interface RpcReferenceHydrationOptions<Value extends object> {
  /** Creates the local facade when this reference is first observed. */
  readonly create: () => Value;

  /** Applies a later safe body to the existing facade identity. */
  readonly update?: (value: Value) => void;
}

/** Capability for reviving one session-authorized remote reference. */
export interface RpcReferenceHydrator {
  /**
   * Returns a stable local identity for a validated serialized reference.
   *
   * @param value - Validated plugin-qualified serialized reference.
   * @param options - Local facade creation and optional update behavior.
   * @returns The existing or newly created local facade.
   */
  <Value extends object>(
    value: RpcSerializedValue,
    options: RpcReferenceHydrationOptions<Value>,
  ): Value;
}

/** Least-capability input for bottom-up plugin value hydration. */
export interface RpcHydrateValueContext {
  /** Validated plugin-qualified value representation. */
  readonly serialized: RpcSerializedValue;

  /** Recursively hydrates one nested representation. */
  readonly hydrate: RpcValueHydrator;

  /** Revives one authorized remote reference without exposing its wire identity. */
  readonly hydrateReference: RpcReferenceHydrator;

  /** Sends lifecycle control only through negotiated plugin namespaces. */
  readonly send: RpcPluginMessenger;
}

/** One validated plugin-owned value or reference control operation. */
export interface RpcValueControlOperation<Payload = unknown> {
  /** Stable wire-plugin identity owning this control operation. */
  readonly plugin: string;

  /** Plugin-local message namespace. */
  readonly namespace: string;

  /** Semantic action within the plugin namespace. */
  readonly action: string;

  /** Validated bounded control payload. */
  readonly payload: Payload;
}

/** Successful claim of one plugin value-control operation. */
export interface RpcValueControlResult {
  /** Indicates that the plugin owned and handled the operation. */
  readonly handled: true;
}

/** Least-capability input for plugin value and reference control. */
export interface RpcControlValueContext {
  /** Validated plugin-qualified control operation. */
  readonly operation: RpcValueControlOperation;

  /** Aborts when the owning session begins teardown. */
  readonly signal: AbortSignal;

  /** Recursively hydrates nested values in the validated control payload. */
  readonly hydrate: RpcValueHydrator;

  /**
   * Resolves the operation's already-authorized reference when it has one.
   *
   * No wire identifier or mutable authority registry is exposed.
   */
  readonly resolveReference: () => object | undefined;

  /** Sends follow-up control only through negotiated plugin namespaces. */
  readonly send: RpcPluginMessenger;
}

/** Semantic category traversing incoming or outgoing RPC middleware. */
export type RpcOperationKind =
  | 'call'
  | 'notification'
  | 'promise'
  | 'stream'
  | 'reference'
  | 'plugin';

/** Target category for call and notification operations. */
export type RpcInvocationTarget = 'root' | 'reference';

/** Semantic call operation. */
export interface RpcCallOperation {
  /** Operation discriminator. */
  readonly kind: 'call';

  /** Whether dispatch starts at the root or an authorized reference. */
  readonly target: RpcInvocationTarget;

  /** Application-level call payload. */
  readonly payload: unknown;
}

/** Semantic fire-and-forget invocation operation. */
export interface RpcNotificationOperation {
  /** Operation discriminator. */
  readonly kind: 'notification';

  /** Whether dispatch starts at the root or an authorized reference. */
  readonly target: RpcInvocationTarget;

  /** Application-level notification payload. */
  readonly payload: unknown;
}

/** Semantic promise lifecycle operation. */
export interface RpcPromiseOperation {
  /** Operation discriminator. */
  readonly kind: 'promise';

  /** Promise lifecycle transition. */
  readonly action: 'resolve' | 'reject' | 'cancel';

  /** Promise settlement or cancellation payload. */
  readonly payload: unknown;
}

/** Semantic stream lifecycle or data operation. */
export interface RpcStreamOperation {
  /** Operation discriminator. */
  readonly kind: 'stream';

  /** Stream lifecycle or demand transition. */
  readonly action: 'open' | 'pull' | 'item' | 'complete' | 'error' | 'cancel';

  /** Stream control or item payload. */
  readonly payload: unknown;
}

/** Semantic core reference lifecycle operation. */
export interface RpcReferenceOperation {
  /** Operation discriminator. */
  readonly kind: 'reference';

  /** Reference lifecycle transition. */
  readonly action: 'release' | 'retain' | 'control';

  /** Reference operation payload. */
  readonly payload: unknown;
}

/** Semantic operation owned by a negotiated wire plugin. */
export interface RpcPluginOperation {
  /** Operation discriminator. */
  readonly kind: 'plugin';

  /** Stable wire-plugin identity. */
  readonly plugin: string;

  /** Plugin-local message namespace. */
  readonly namespace: string;

  /** Plugin-defined semantic operation payload. */
  readonly payload: unknown;
}

/** Unified semantic operation observed by RPC middleware. */
export type RpcOperation =
  | RpcCallOperation
  | RpcNotificationOperation
  | RpcPromiseOperation
  | RpcStreamOperation
  | RpcReferenceOperation
  | RpcPluginOperation;

/** Successful semantic operation outcome. */
export interface RpcOperationSuccess {
  /** Outcome discriminator. */
  readonly status: 'success';

  /** Semantic result, if the operation produces one. */
  readonly value: unknown;
}

/** Failed semantic operation outcome. */
export interface RpcOperationFailure {
  /** Outcome discriminator. */
  readonly status: 'error';

  /** Normalized application or infrastructure failure. */
  readonly error: ApplicationError;
}

/** Cooperatively cancelled semantic operation outcome. */
export interface RpcOperationCancellation {
  /** Outcome discriminator. */
  readonly status: 'cancelled';

  /** Optional bounded diagnostic reason. */
  readonly reason?: unknown;
}

/** Outcome returned through RPC semantic middleware. */
export type RpcOperationOutcome =
  | RpcOperationSuccess
  | RpcOperationFailure
  | RpcOperationCancellation;

/** Shared least-capability input for semantic operation middleware. */
export interface RpcOperationContext {
  /** Current semantic operation; wire framing and authority tables are absent. */
  readonly operation: RpcOperation;

  /** Aborts when this operation or its session is cancelled. */
  readonly signal: AbortSignal;

  /**
   * Replaces only the operation-specific semantic payload.
   *
   * Kind, target category, plugin identity, and other authority-bearing identity
   * remain immutable.
   */
  readonly setPayload: (payload: unknown) => void;
}

/** Incoming semantic middleware input with one engine-owned continuation. */
export interface RpcIncomingOperationContext
  extends RpcOperationContext, PluginContinuation<Promise<RpcOperationOutcome>> {}

/** Outgoing semantic middleware input with continuation and explicit retry capability. */
export interface RpcOutgoingOperationContext
  extends RpcOperationContext, PluginContinuation<Promise<RpcOperationOutcome>> {
  /**
   * Starts a distinct outgoing attempt when application semantics permit replay.
   *
   * @param operation - Semantic operation for the new attempt.
   * @returns The new attempt's outcome.
   */
  readonly attempt: (operation: RpcOperation) => Promise<RpcOperationOutcome>;
}

/** One plugin-qualified semantic control message sent within an active session. */
export interface RpcPluginMessage<Payload = unknown> {
  /** Stable active wire-plugin identity. */
  readonly plugin: string;

  /** Plugin-local message namespace. */
  readonly namespace: string;

  /** Semantic action within the namespace. */
  readonly action: string;

  /** Bounded recursively serialized payload. */
  readonly payload: Payload;
}

/** Capability for sending a negotiated plugin control message. */
export interface RpcPluginMessenger {
  /**
   * Sends one plugin-qualified control message.
   *
   * @param message - Semantic message owned by an active wire plugin.
   * @returns A promise settling after transport backpressure.
   */
  (message: RpcPluginMessage): Promise<void>;
}

/** Least-capability endpoint setup input. */
export interface RpcSetupEndpointContext {
  /** Aborts when endpoint disposal begins. */
  readonly signal: AbortSignal;
}

/**
 * Least-capability established-session setup input.
 *
 * @template ResourceCategory - Plugin-local declared resource category names.
 */
export interface RpcSetupSessionContext<ResourceCategory extends string = string> {
  /** Active immutable wire-plugin selections. */
  readonly plugins: readonly RpcWirePluginCompatibility[];

  /** Aborts when session teardown begins. */
  readonly signal: AbortSignal;

  /** Sends control traffic only through negotiated plugin namespaces. */
  readonly send: RpcPluginMessenger;

  /** Reserves only this plugin's declared finite session resources. */
  readonly budget: RpcPluginBudget<ResourceCategory>;
}

/** Scope of an RPC lifecycle observation. */
export type RpcObservationScope = 'endpoint' | 'session';

/** Value-free endpoint or session lifecycle observation. */
export interface RpcLifecycleObservation {
  /** Observation discriminator. */
  readonly kind: 'lifecycle';

  /** Lifecycle owner. */
  readonly scope: RpcObservationScope;

  /** Completed or current lifecycle phase. */
  readonly phase: 'setting-up' | 'active' | 'disposing' | 'disposed';
}

/** Value-free semantic operation observation. */
export interface RpcOperationObservation {
  /** Observation discriminator. */
  readonly kind: 'operation';

  /** Semantic operation category without its application payload. */
  readonly operation: RpcOperationKind;

  /** Observed operation phase. */
  readonly phase: 'started' | 'settled';

  /** Local opaque correlation value, when useful for diagnostics. */
  readonly correlation?: unknown;

  /** Settled outcome classification without arguments or results. */
  readonly outcome?: RpcOperationOutcome['status'];

  /** Measured duration for a settled operation. */
  readonly duration?: number;
}

/** Value-free serialization or hydration observation. */
export interface RpcValueObservation {
  /** Observation discriminator. */
  readonly kind: 'value';

  /** Completed value phase. */
  readonly phase: 'serialized' | 'hydrated';

  /** Plugin-qualified value namespace. */
  readonly namespace: string;

  /** Number of values represented by this observation. */
  readonly count: number;
}

/**
 * Core resource-accounting observation without application data.
 *
 * Category discrimination preserves the category's exact unit and mode.
 */
export type RpcCoreResourceObservationFact = {
  readonly [Category in RpcCoreBudgetCategory]: {
    /** Observation discriminator. */
    readonly kind: 'resource';

    /** Core ownership discriminator. */
    readonly owner: 'core';

    /** Stable core resource category. */
    readonly category: Category;

    /** Immutable current use, exact unit, mode, and effective limit. */
    readonly observation: RpcCoreResourceObservations[Category];
  };
}[RpcCoreBudgetCategory];

/** Plugin-qualified resource-accounting observation without application data. */
export interface RpcPluginResourceObservationFact {
  /** Observation discriminator. */
  readonly kind: 'resource';

  /** Plugin ownership discriminator. */
  readonly owner: 'plugin';

  /** Stable wire identity or local-only plugin name. */
  readonly plugin: string;

  /** Plugin-local declared resource category. */
  readonly category: string;

  /** Immutable current use, unit, mode, and effective limit. */
  readonly observation: RpcResourceObservation<RpcBudgetUnit, 'capacity'>;
}

/** Core or plugin-qualified resource-accounting observation. */
export type RpcResourceObservationFact =
  | RpcCoreResourceObservationFact
  | RpcPluginResourceObservationFact;

/** Value-free observation delivered to contained observer hooks. */
export type RpcObservation =
  | RpcLifecycleObservation
  | RpcOperationObservation
  | RpcValueObservation
  | RpcResourceObservationFact;

/** Least-capability observer input. */
export interface RpcObserveContext {
  /** Value-free lifecycle, operation, value, or resource fact. */
  readonly observation: RpcObservation;

  /** Aborts when the observation's owning scope begins teardown. */
  readonly signal: AbortSignal;
}

/** Least-capability session cleanup input. */
export interface RpcDisposeSessionContext {
  /** Active immutable wire-plugin selections for the closing session. */
  readonly plugins: readonly RpcWirePluginCompatibility[];

  /** Signal already aborted for terminal session cleanup. */
  readonly signal: AbortSignal;
}

/** Least-capability endpoint cleanup input. */
export interface RpcDisposeEndpointContext {
  /** Signal already aborted for terminal endpoint cleanup. */
  readonly signal: AbortSignal;
}

/**
 * RPC-specific lifecycle hook catalog executed by the ecosystem plugin engine.
 *
 * @template PluginName - Literal plugin name used for typed context state.
 * @template ResourceCategory - Plugin-local declared resource category names.
 */
export interface RpcPluginHooks<
  PluginName extends string = string,
  ResourceCategory extends string = string,
> {
  /**
   * Matches and serializes one owner-side value.
   *
   * Returning `undefined` passes to the next ordered plugin.
   */
  serializeValue(
    this: HookContext<PluginName>,
    context: RpcSerializeValueContext,
  ): RpcSerializedValue | void;

  /**
   * Hydrates one validated plugin-qualified value.
   *
   * Returning `undefined` passes to the next ordered plugin. Successful
   * hydration is wrapped so `{value: undefined}` remains distinguishable.
   */
  hydrateValue(
    this: HookContext<PluginName>,
    context: RpcHydrateValueContext,
  ): RpcHydratedValue | void;

  /** Claims and handles one plugin value or reference control operation. */
  controlValue(
    this: HookContext<PluginName>,
    context: RpcControlValueContext,
  ): MaybeAsync<RpcValueControlResult | void>;

  /** Wraps one accepted incoming semantic operation. */
  incomingOperation(
    this: HookContext<PluginName>,
    context: RpcIncomingOperationContext,
  ): Promise<RpcOperationOutcome>;

  /** Wraps one outgoing semantic operation. */
  outgoingOperation(
    this: HookContext<PluginName>,
    context: RpcOutgoingOperationContext,
  ): Promise<RpcOperationOutcome>;

  /** Initializes endpoint-scoped plugin state. */
  setupEndpoint(this: HookContext<PluginName>, context: RpcSetupEndpointContext): MaybeAsync<void>;

  /** Initializes negotiated session-scoped plugin state. */
  setupSession(
    this: HookContext<PluginName>,
    context: RpcSetupSessionContext<ResourceCategory>,
  ): MaybeAsync<void>;

  /** Observes a value-free fact through PluginEngine's contained strategy. */
  observe(this: HookContext<PluginName>, context: RpcObserveContext): MaybeAsync<void>;

  /** Releases session-scoped plugin state during deterministic teardown. */
  disposeSession(
    this: HookContext<PluginName>,
    context: RpcDisposeSessionContext,
  ): MaybeAsync<void>;

  /** Releases endpoint-scoped plugin state during deterministic teardown. */
  disposeEndpoint(
    this: HookContext<PluginName>,
    context: RpcDisposeEndpointContext,
  ): MaybeAsync<void>;
}

/**
 * One ordinary ecosystem plugin implementing any subset of RPC hooks.
 *
 * The optional wire descriptor is metadata rather than a hook. Omitting it
 * creates a compatibility-neutral local middleware or observer plugin.
 *
 * @template Name - Literal plugin name used for its persistent PluginEngine store.
 * @template ResourceCategory - Plugin-local declared resource category names.
 */
export type RpcPlugin<
  Name extends string = string,
  ResourceCategory extends string = string,
> = Plugin<RpcPluginHooks<Name, ResourceCategory>, Name, RpcPluginMetadata<ResourceCategory>>;
