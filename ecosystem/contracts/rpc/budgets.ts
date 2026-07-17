/** Stable unit used by an RPC resource category. */
export type RpcBudgetUnit = 'bytes' | 'count' | 'depth';

/**
 * How an RPC resource limit is applied.
 *
 * A `maximum` bounds one frame or value graph. A `capacity` bounds state
 * retained or active concurrently within the session.
 */
export type RpcBudgetMode = 'maximum' | 'capacity';

/**
 * Unit and accounting mode assigned to one resource category.
 *
 * @template Unit - Stable measurement unit for the category.
 * @template Mode - Whether the limit is a maximum or concurrent capacity.
 */
export interface RpcBudgetDefinition<
  Unit extends RpcBudgetUnit = RpcBudgetUnit,
  Mode extends RpcBudgetMode = RpcBudgetMode,
> {
  /** Stable measurement unit. */
  readonly unit: Unit;

  /** Accounting behavior of the limit. */
  readonly mode: Mode;
}

/**
 * Closed definition map for resources accounted by RPC core.
 *
 * Issued references represent authority sent to the peer. Received references
 * represent authority hydrated from the peer. Plugin categories refine the
 * aggregate plugin message and state categories without replacing them.
 */
export type RpcCoreBudgetDefinitionMap = {
  /** Complete encoded or conservatively estimated frame representation. */
  readonly 'frame.bytes': RpcBudgetDefinition<'bytes', 'maximum'>;

  /** Semantic application or plugin payload within one frame. */
  readonly 'payload.bytes': RpcBudgetDefinition<'bytes', 'maximum'>;

  /** Maximum nesting of one decoded value graph. */
  readonly 'decode.depth': RpcBudgetDefinition<'depth', 'maximum'>;

  /** Maximum properties and collection entries in one decoded value graph. */
  readonly 'decode.entries': RpcBudgetDefinition<'count', 'maximum'>;

  /** Calls awaiting dispatch, execution, or correlation settlement. */
  readonly 'calls.pending': RpcBudgetDefinition<'count', 'capacity'>;

  /** Notifications queued or executing without an application outcome. */
  readonly 'notifications.pending': RpcBudgetDefinition<'count', 'capacity'>;

  /** Object references issued to the peer. */
  readonly 'references.object.issued': RpcBudgetDefinition<'count', 'capacity'>;

  /** Object references received from the peer. */
  readonly 'references.object.received': RpcBudgetDefinition<'count', 'capacity'>;

  /** Function references issued to the peer. */
  readonly 'references.function.issued': RpcBudgetDefinition<'count', 'capacity'>;

  /** Function references received from the peer. */
  readonly 'references.function.received': RpcBudgetDefinition<'count', 'capacity'>;

  /** Promise references issued to the peer. */
  readonly 'references.promise.issued': RpcBudgetDefinition<'count', 'capacity'>;

  /** Promise references received from the peer. */
  readonly 'references.promise.received': RpcBudgetDefinition<'count', 'capacity'>;

  /** Stream references issued to the peer. */
  readonly 'references.stream.issued': RpcBudgetDefinition<'count', 'capacity'>;

  /** Stream references received from the peer. */
  readonly 'references.stream.received': RpcBudgetDefinition<'count', 'capacity'>;

  /** Plugin-defined references issued to the peer. */
  readonly 'references.plugin.issued': RpcBudgetDefinition<'count', 'capacity'>;

  /** Plugin-defined references received from the peer. */
  readonly 'references.plugin.received': RpcBudgetDefinition<'count', 'capacity'>;

  /** Unsettled remote-promise bookkeeping independent of reference identity. */
  readonly 'promises.pending': RpcBudgetDefinition<'count', 'capacity'>;

  /** Streams that have not reached a terminal state. */
  readonly 'streams.active': RpcBudgetDefinition<'count', 'capacity'>;

  /** Stream items retained across producer, transport, and consumer queues. */
  readonly 'streams.buffered.items': RpcBudgetDefinition<'count', 'capacity'>;

  /** Stream item representation retained across session queues. */
  readonly 'streams.buffered.bytes': RpcBudgetDefinition<'bytes', 'capacity'>;

  /** Remote reactive references currently watched by this session. */
  readonly 'watches.active': RpcBudgetDefinition<'count', 'capacity'>;

  /** Reactive updates and recovery work queued for this session. */
  readonly 'updates.queued': RpcBudgetDefinition<'count', 'capacity'>;

  /** Values whose ownership transfer is pending or retained by the session. */
  readonly 'transferables.active': RpcBudgetDefinition<'count', 'capacity'>;

  /** Plugin control messages awaiting handling or transport settlement. */
  readonly 'plugins.messages.pending': RpcBudgetDefinition<'count', 'capacity'>;

  /** Aggregate plugin-owned session state entries reserved through RPC. */
  readonly 'plugins.state': RpcBudgetDefinition<'count', 'capacity'>;
};

/** Stable name of one core RPC resource category. */
export type RpcCoreBudgetCategory = keyof RpcCoreBudgetDefinitionMap;

/**
 * Complete finite limits for every core RPC resource category.
 *
 * Every value is a non-negative safe integer. Zero disables the category.
 * Missing categories, fractional values, non-finite values, and unsafe integers
 * make an explicit offer invalid.
 */
export type RpcCoreBudgetLimits = {
  readonly [Category in RpcCoreBudgetCategory]: number;
};

/**
 * One named resource category declared by an RPC plugin.
 *
 * Names are unique within the declaring plugin. Wire plugins qualify names by
 * stable wire identity; local-only plugins qualify them by local plugin name.
 *
 * Plugin sub-budgets account concurrent or retained capacity. Per-frame and
 * per-graph maxima remain enforced by the core frame, payload, and decode
 * categories.
 *
 * @template Category - Plugin-local category name.
 * @template Unit - Stable measurement unit for the category.
 */
export interface RpcPluginBudgetCategoryDescriptor<
  Category extends string = string,
  Unit extends RpcBudgetUnit = RpcBudgetUnit,
> extends RpcBudgetDefinition<Unit, 'capacity'> {
  /** Plugin-local category name. */
  readonly category: Category;
}

/** One finite limit offered for a plugin-qualified resource category. */
export interface RpcPluginBudgetCategoryOffer extends RpcPluginBudgetCategoryDescriptor {
  /** Non-negative finite safe-integer limit; zero disables the category. */
  readonly limit: number;
}

/** Finite resource offer for one wire-affecting plugin. */
export interface RpcPluginBudgetOffer {
  /** Stable wire-plugin identity qualifying every category. */
  readonly plugin: string;

  /** Complete non-duplicated category offers declared by the plugin. */
  readonly categories: readonly RpcPluginBudgetCategoryOffer[];
}

/**
 * Local finite limits offered during session compatibility.
 *
 * Omission at session establishment selects implementation-defined finite
 * defaults. An explicit offer must include every core category and each active
 * wire plugin's declared categories.
 */
export interface RpcSessionBudgetOffer {
  /** Complete core limit offer. */
  readonly core: RpcCoreBudgetLimits;

  /** Offers for active wire-affecting plugins. */
  readonly plugins: readonly RpcPluginBudgetOffer[];
}

/** Effective immutable limit for one negotiated plugin category. */
export interface RpcPluginBudgetCategoryCompatibility extends RpcPluginBudgetCategoryDescriptor {
  /** Conservative effective non-negative safe-integer limit. */
  readonly limit: number;
}

/** Effective immutable limits for one active wire plugin. */
export interface RpcPluginBudgetCompatibility {
  /** Stable active wire-plugin identity. */
  readonly plugin: string;

  /** Effective limits for the plugin's negotiated categories. */
  readonly categories: readonly RpcPluginBudgetCategoryCompatibility[];
}

/** Immutable finite resource compatibility established for one session. */
export interface RpcSessionBudgetCompatibility {
  /** Conservative effective limits for every core category. */
  readonly core: RpcCoreBudgetLimits;

  /** Effective limits for active wire-plugin categories. */
  readonly plugins: readonly RpcPluginBudgetCompatibility[];
}

/**
 * Immutable usage and limit observation for one resource category.
 *
 * @template Unit - Stable measurement unit for the category.
 * @template Mode - Accounting behavior of the category.
 */
export interface RpcResourceObservation<
  Unit extends RpcBudgetUnit = RpcBudgetUnit,
  Mode extends RpcBudgetMode = RpcBudgetMode,
> extends RpcBudgetDefinition<Unit, Mode> {
  /** Amount currently reserved or measured by the session. */
  readonly used: number;

  /** Finite effective maximum or capacity. */
  readonly limit: number;
}

/** Immutable observations for every core RPC resource category. */
export type RpcCoreResourceObservations = {
  readonly [Category in RpcCoreBudgetCategory]: RpcResourceObservation<
    RpcCoreBudgetDefinitionMap[Category]['unit'],
    RpcCoreBudgetDefinitionMap[Category]['mode']
  >;
};

/** Immutable observations for one plugin's session resources. */
export interface RpcPluginResourceObservations {
  /** Stable wire identity or local-only plugin name qualifying the categories. */
  readonly plugin: string;

  /** Observations keyed by plugin-local declared category name. */
  readonly categories: Readonly<Record<string, RpcResourceObservation<RpcBudgetUnit, 'capacity'>>>;
}

/** Immutable resource observations for one live RPC session. */
export interface RpcSessionResources {
  /** Stable observations for every core category. */
  readonly core: RpcCoreResourceObservations;

  /** Qualified observations for active wire and local-only plugins. */
  readonly plugins: readonly RpcPluginResourceObservations[];
}

/** Outcome already selected by RPC after capacity cannot be acquired. */
export type RpcBudgetExhaustionDisposition = 'reject-operation' | 'session-terminating';

/**
 * One plugin-local amount requested as part of an atomic reservation.
 *
 * @template Category - Plugin-local declared category name.
 */
export interface RpcPluginBudgetReservationRequest<Category extends string = string> {
  /** Plugin-local category to reserve. */
  readonly category: Category;

  /** Positive finite safe-integer amount to acquire. */
  readonly amount: number;
}

/**
 * One atomic plugin-state reservation request.
 *
 * @template Category - Plugin-local declared category name.
 */
export interface RpcPluginBudgetReservationOptions<Category extends string = string> {
  /** Positive finite safe-integer entries charged to aggregate plugin state. */
  readonly entries: number;

  /** Non-empty plugin-local capacity amounts acquired with the aggregate entries. */
  readonly categories: readonly [
    RpcPluginBudgetReservationRequest<Category>,
    ...RpcPluginBudgetReservationRequest<Category>[],
  ];
}

/**
 * Information returned when an atomic plugin reservation cannot be acquired.
 *
 * @template Category - Plugin-local declared category name.
 */
export interface RpcPluginBudgetExhaustion<Category extends string = string> {
  /**
   * Host-selected outcome for the failed acquisition.
   *
   * `session-terminating` means RPC has already begun terminal teardown.
   */
  readonly disposition: RpcBudgetExhaustionDisposition;

  /** Request rejected without changing aggregate or plugin-local usage. */
  readonly requested: RpcPluginBudgetReservationOptions<Category>;

  /** Latest immutable observations for every category declared by the plugin. */
  readonly resources: Readonly<Record<Category, RpcResourceObservation<RpcBudgetUnit, 'capacity'>>>;
}

/** Opaque session-bound capacity acquired atomically for one plugin. */
export interface RpcPluginBudgetReservation {
  /** Whether this lease has already been released or reclaimed by teardown. */
  readonly released: boolean;

  /**
   * Idempotently releases exactly the capacity acquired by this lease.
   *
   * The lease cannot release an arbitrary amount or affect another session.
   */
  release(): void;
}

/** Successful atomic plugin budget reservation. */
export interface RpcPluginBudgetReservationSuccess {
  /** Successful reservation discriminator. */
  readonly ok: true;

  /** Opaque lease owning the acquired capacity. */
  readonly reservation: RpcPluginBudgetReservation;

  /** Exhaustion details are absent after successful acquisition. */
  readonly exhaustion: undefined;
}

/**
 * Failed atomic plugin budget reservation.
 *
 * @template Category - Plugin-local declared category name.
 */
export interface RpcPluginBudgetReservationFailure<Category extends string = string> {
  /** Failed reservation discriminator. */
  readonly ok: false;

  /** No lease exists when acquisition fails. */
  readonly reservation: undefined;

  /** Immutable exhaustion details and required disposition. */
  readonly exhaustion: RpcPluginBudgetExhaustion<Category>;
}

/**
 * Result of one atomic plugin budget reservation attempt.
 *
 * @template Category - Plugin-local declared category name.
 */
export type RpcPluginBudgetReservationResult<Category extends string = string> =
  | RpcPluginBudgetReservationSuccess
  | RpcPluginBudgetReservationFailure<Category>;

/**
 * Least-capability resource ledger scoped to one plugin in one session.
 *
 * It exposes only declared plugin-local categories. Core and other plugin
 * counters remain inaccessible. Session teardown may reclaim outstanding
 * leases independently of plugin cooperation.
 */
export interface RpcPluginBudget<Category extends string = string> {
  /** Latest immutable observations for this plugin's declared categories. */
  readonly resources: Readonly<Record<Category, RpcResourceObservation<RpcBudgetUnit, 'capacity'>>>;

  /**
   * Atomically acquires aggregate plugin-state entries and declared sub-budgets.
   *
   * Success charges `plugins.state` by `entries`, reserves every plugin-local
   * category amount, and returns one lease owning all charges. Capacity
   * exhaustion changes no usage. A `session-terminating` failure means RPC has
   * already begun host-owned teardown.
   *
   * Unknown or duplicate categories and non-positive, fractional, non-finite,
   * or unsafe integer amounts are invalid local requests. They throw without
   * changing resource usage rather than producing an exhaustion result.
   *
   * @param options - Aggregate entries and non-empty category amounts.
   * @returns A discriminated capacity-acquisition result.
   */
  reserve(
    options: RpcPluginBudgetReservationOptions<Category>,
  ): RpcPluginBudgetReservationResult<Category>;
}
