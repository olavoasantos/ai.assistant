import type {
  RpcBudgetExhaustionDisposition,
  RpcClient,
  RpcConnectedSession,
  RpcCoreBudgetCategory,
  RpcNode,
  RpcPlugin,
  RpcServer,
  RpcSession,
  RpcSessionBudgetOffer,
  RpcSessionEstablishmentOptions,
  RpcSessionResources,
  RpcTransport,
  RpcTransportClosure,
  RpcTransportDelivery,
  RpcTransportOwnership,
  RpcTransportRepresentation,
} from '@ai.assistant/contracts/rpc';
import type {Telemetry, TelemetryOptions} from '@ai.assistant/contracts/telemetry';

/** Minimal server API used by the foundation compliance suite. */
export interface RpcComplianceServerApi {
  /** Returns the supplied value so the suite can prove asynchronous root invocation. */
  echo(value: string): string;
}

/** Minimal client API available for symmetric session construction. */
export interface RpcComplianceClientApi {
  /** Receives a server-initiated value during symmetric peer tests. */
  receive(value: string): void;
}

/** Side of a paired RPC test transport. */
export type RpcTestSide = 'server' | 'client';

/** Direction in which one test delivery travels. */
export type RpcTestDirection = 'server-to-client' | 'client-to-server';

/** Ownership direction exercised by a rich-value compliance case. */
export type RpcTestOwnershipDirection = RpcTestDirection | 'round-trip' | 'not-applicable';

/** Remote-value family identified in compliance output. */
export type RpcTestValueFamily =
  | 'root'
  | 'copy'
  | 'object'
  | 'model'
  | 'function'
  | 'promise'
  | 'stream'
  | 'plugin'
  | 'signal'
  | 'not-applicable';

/** Semantic lifecycle phase identified in compliance output and inspection. */
export type RpcTestLifecyclePhase =
  | 'construction'
  | 'admission'
  | 'compatibility'
  | 'root-delivery'
  | 'active'
  | 'disposing'
  | 'disposed'
  | 'rejected';

/** Metadata attached to one implementation-independent compliance case. */
export interface RpcComplianceCaseDescriptor {
  /** Behavioral promise being verified. */
  readonly promise: string;

  /** Lifecycle phase in which the promise must hold. */
  readonly phase: RpcTestLifecyclePhase;

  /** Ownership direction under test. */
  readonly direction: RpcTestOwnershipDirection;

  /** Remote-value family under test. */
  readonly valueFamily: RpcTestValueFamily;

  /** Transport representation, when the case crosses a transport. */
  readonly representation?: RpcTransportRepresentation;

  /** Additional stable case distinction. */
  readonly variant?: string;
}

/**
 * One value-family fixture used to build direction and representation matrices.
 *
 * @template Value - Fixture data carried into each generated case.
 */
export interface RpcComplianceValueCase<Value = unknown> {
  /** Stable case name. */
  readonly name: string;

  /** Remote-value family represented by the fixture. */
  readonly family: RpcTestValueFamily;

  /** Owner-side value or factory metadata used by the consuming suite. */
  readonly value: Value;

  /** Optional stable distinction within the value family. */
  readonly variant?: string;
}

/**
 * Options for generating reusable remote-value compliance rows.
 *
 * @template Value - Fixture data carried into each generated row.
 */
export interface RpcComplianceMatrixOptions<Value = unknown> {
  /** Behavioral promise shared by generated rows. */
  readonly promise: string;

  /** Lifecycle phase shared by generated rows. */
  readonly phase: RpcTestLifecyclePhase;

  /** Value fixtures to cross with direction and representation. */
  readonly values: readonly RpcComplianceValueCase<Value>[];

  /** Ownership directions to exercise. */
  readonly directions: readonly RpcTestOwnershipDirection[];

  /** Transport representations to exercise. */
  readonly representations: readonly RpcTransportRepresentation[];

  /** Optional predicate excluding combinations that are not meaningful. */
  readonly include?: (row: RpcComplianceMatrixRow<Value>) => boolean;
}

/**
 * One fully described row produced by the compliance matrix helper.
 *
 * @template Value - Fixture data carried by this row.
 */
export interface RpcComplianceMatrixRow<Value = unknown> extends RpcComplianceCaseDescriptor {
  /** Stable value-fixture name. */
  readonly name: string;

  /** Owner-side fixture data for this row. */
  readonly value: Value;

  /** A generated row always identifies its transport representation. */
  readonly representation: RpcTransportRepresentation;
}

/** Callback scheduled on deterministic virtual time. */
export interface RpcTestScheduledCallback {
  /** Performs one scheduled unit of work. */
  (): void | Promise<void>;
}

/** Options for scheduling one deterministic test task. */
export interface RpcTestScheduleOptions {
  /** Non-negative delay from the scheduler's current virtual time. */
  readonly delay?: number;

  /** Bounded diagnostic label shown when work cannot quiesce. */
  readonly label?: string;
}

/** Cancellable handle for one deterministic test task. */
export interface RpcTestScheduledTask {
  /** Stable insertion sequence within the scheduler. */
  readonly sequence: number;

  /** Virtual deadline at which the task becomes eligible. */
  readonly deadline: number;

  /** Optional diagnostic label. */
  readonly label?: string;

  /** Whether the task was cancelled before execution. */
  readonly cancelled: boolean;

  /** Whether callback execution has settled. */
  readonly completed: boolean;

  /** Cancels pending execution and reports whether this call changed state. */
  cancel(): boolean;
}

/** Deterministic virtual-time capability used by compliance fixtures. */
export interface RpcTestScheduler {
  /** Current non-negative finite virtual time. */
  readonly now: number;

  /** Number of non-cancelled tasks awaiting execution. */
  readonly pending: number;

  /** Immutable pending tasks in execution order. */
  readonly tasks: readonly RpcTestScheduledTask[];

  /** Schedules one callback relative to current virtual time. */
  schedule(
    callback: RpcTestScheduledCallback,
    options?: RpcTestScheduleOptions,
  ): RpcTestScheduledTask;

  /** Runs the next pending task and reports whether one ran. */
  runNext(): Promise<boolean>;

  /** Advances by a non-negative duration and runs every due task. */
  advanceBy(duration: number): Promise<number>;

  /** Advances to a non-decreasing virtual time and runs every due task. */
  advanceTo(time: number): Promise<number>;

  /** Runs currently due tasks until quiescent or a finite step bound is exceeded. */
  runUntilIdle(maxSteps?: number): Promise<number>;
}

/**
 * Immutable observation of one queued transport delivery.
 *
 * @template Frame - Representation-native complete frame type.
 * @template Context - Per-frame transport metadata.
 */
export interface RpcTestQueuedDelivery<Frame = unknown, Context = unknown> {
  /** Stable sequence assigned by the controllable transport. */
  readonly sequence: number;

  /** Direction in which the delivery is queued. */
  readonly direction: RpcTestDirection;

  /** Complete representation-native delivery. */
  readonly delivery: RpcTransportDelivery<Frame, Context>;
}

/**
 * Read-only state of an adversarial transport pair.
 *
 * @template Frame - Representation-native complete frame type.
 * @template Context - Per-frame transport metadata.
 */
export interface RpcTestTransportSnapshot<Frame = unknown, Context = unknown> {
  /** Whether each side's readiness promise has settled successfully. */
  readonly ready: Readonly<Record<RpcTestSide, boolean>>;

  /** Deliveries waiting below public RPC APIs. */
  readonly queued: readonly RpcTestQueuedDelivery<Frame, Context>[];

  /** Number of sends held by artificial backpressure on each side. */
  readonly backpressured: Readonly<Record<RpcTestSide, number>>;

  /** Whether each side has reached terminal closure. */
  readonly closed: Readonly<Record<RpcTestSide, boolean>>;

  /** Active inbound subscriptions on each side. */
  readonly subscriptions: Readonly<Record<RpcTestSide, number>>;
}

/**
 * Privileged mechanical controls for one paired test transport.
 *
 * @template Frame - Representation-native complete frame type.
 * @template Context - Per-frame transport metadata.
 */
export interface RpcAdversarialTransportControl<Frame = unknown, Context = unknown> {
  /** Latest immutable transport state. */
  readonly snapshot: RpcTestTransportSnapshot<Frame, Context>;

  /** Settles one side's readiness successfully. */
  releaseReady(side: RpcTestSide): void;

  /** Rejects one side's readiness without creating a session. */
  rejectReady(side: RpcTestSide, reason: unknown): void;

  /** Holds future send settlements for one side. */
  holdSends(side: RpcTestSide): void;

  /** Releases held send settlements, optionally limiting the count. */
  releaseSends(side: RpcTestSide, count?: number): void;

  /** Rejects held send settlements for one side. */
  rejectSends(side: RpcTestSide, reason: unknown): void;

  /** Delivers the next queued frame in one direction. */
  deliverNext(direction: RpcTestDirection): Promise<boolean>;

  /** Delivers all currently queued frames, optionally in one direction. */
  deliverAll(direction?: RpcTestDirection): Promise<number>;

  /** Drops the next queued delivery in one direction. */
  dropNext(direction: RpcTestDirection): boolean;

  /** Duplicates the next queued delivery in one direction. */
  duplicateNext(direction: RpcTestDirection): boolean;

  /** Moves one queued delivery before another within the same direction. */
  reorder(direction: RpcTestDirection, from: number, to: number): void;

  /** Injects a representation-native delivery directly at one side. */
  inject(side: RpcTestSide, delivery: RpcTransportDelivery<Frame, Context>): Promise<void>;

  /** Emits one nonterminal transport error at one side. */
  error(side: RpcTestSide, reason: unknown): void;

  /** Closes one side, optionally racing peer and endpoint closure. */
  close(side: RpcTestSide, closure?: RpcTransportClosure): void;
}

/**
 * Paired structural transports plus privileged test controls.
 *
 * @template Frame - Representation-native complete frame type.
 * @template Context - Per-frame transport metadata.
 */
export interface RpcAdversarialTransportPair<Frame = unknown, Context = unknown> {
  /** Representation implemented by both paired transports. */
  readonly representation: RpcTransportRepresentation;

  /** Transport admitted by the server side. */
  readonly server: RpcTransport<Frame, Context>;

  /** Transport connected by the client side. */
  readonly client: RpcTransport<Frame, Context>;

  /** Mechanical controls that operate beneath normal RPC consumers. */
  readonly control: RpcAdversarialTransportControl<Frame, Context>;
}

/** Options supplied when creating a controllable transport pair. */
export interface RpcAdversarialTransportFactoryOptions {
  /** Required frame representation. */
  readonly representation: RpcTransportRepresentation;

  /** Scheduler that owns delivery and closure work. */
  readonly scheduler: RpcTestScheduler;
}

/**
 * Factory for implementation-compatible adversarial transport pairs.
 *
 * @template Frame - Representation-native complete frame type.
 * @template Context - Per-frame transport metadata.
 */
export interface RpcAdversarialTransportFactory<Frame = unknown, Context = unknown> {
  /** Creates a fresh isolated transport pair. */
  (options: RpcAdversarialTransportFactoryOptions): RpcAdversarialTransportPair<Frame, Context>;
}

/** Construction inputs shared by RPC endpoint factories. */
export interface RpcTestEndpointFactoryOptions {
  /** Optional caller-owned telemetry. */
  readonly telemetry?: Telemetry;

  /** Initial RPC plugins supplied to the endpoint. */
  readonly plugins?: readonly RpcPlugin[];
}

/** Factory for conventional RPC server facades. */
export interface RpcTestServerFactory {
  /** Creates a fresh server without admitting a transport. */
  <RemoteApi extends object, LocalApi extends object>(
    options?: RpcTestEndpointFactoryOptions,
  ): RpcServer<RemoteApi, LocalApi>;
}

/** Factory for conventional RPC client facades. */
export interface RpcTestClientFactory {
  /** Creates a fresh disconnected client. */
  <RemoteApi extends object, LocalApi extends object>(
    options?: RpcTestEndpointFactoryOptions,
  ): RpcClient<RemoteApi, LocalApi>;
}

/** Factory for direction-neutral RPC nodes. */
export interface RpcTestNodeFactory {
  /** Creates a fresh node without accepting or connecting a transport. */
  <RemoteApi extends object, LocalApi extends object>(
    options?: RpcTestEndpointFactoryOptions,
  ): RpcNode<RemoteApi, LocalApi>;
}

/** Factory for telemetry injected into RPC endpoints. */
export interface RpcTestTelemetryFactory {
  /** Creates fresh isolated telemetry. */
  (options?: TelemetryOptions): Telemetry;
}

/** Inputs used to create one ordinary RPC plugin for compliance scenarios. */
export interface RpcTestPluginFactoryOptions {
  /** Stable local plugin name. */
  readonly name: string;

  /** Partial RPC plugin behavior and metadata. */
  readonly plugin?: Omit<RpcPlugin, 'name'>;
}

/** Factory for RPC plugins used by compliance scenarios. */
export interface RpcTestPluginFactory {
  /** Creates one plugin object through the implementation's supported boundary. */
  (options: RpcTestPluginFactoryOptions): RpcPlugin;
}

/** Result of deliberately exhausting one session budget category. */
export interface RpcTestBudgetExhaustion {
  /** Category driven to its finite effective limit. */
  readonly category: RpcCoreBudgetCategory;

  /** Host-selected operation rejection or terminal-session outcome. */
  readonly disposition: RpcBudgetExhaustionDisposition;
}

/** Privileged budget-pressure control for one test session fixture. */
export interface RpcTestBudgetControl {
  /** Drives a category to exhaustion through implementation-owned accounting. */
  exhaust(category: RpcCoreBudgetCategory): RpcTestBudgetExhaustion;

  /** Releases test-owned pressure without releasing application reservations. */
  restore(): void;
}

/** Options for one fresh foundation session fixture. */
export interface RpcTestSessionFixtureOptions {
  /** Server-owned root exposed before explicit admission. */
  readonly serverRoot: RpcComplianceServerApi;

  /** Client-owned root available for symmetric session behavior. */
  readonly clientRoot: RpcComplianceClientApi;

  /** Transport representation exercised by the fixture. */
  readonly representation: RpcTransportRepresentation;

  /** Optional explicit finite budget offer. */
  readonly budget?: RpcSessionBudgetOffer;

  /** Transport ownership exercised by the fixture. */
  readonly ownership?: RpcTransportOwnership;
}

/** Promises created together when explicit admission begins. */
export interface RpcTestSessionAttempt {
  /** Server-side admission outcome. */
  readonly admitted: Promise<RpcSession<RpcComplianceClientApi, RpcComplianceServerApi>>;

  /** Client-side connection and root outcome. */
  readonly connected: Promise<RpcConnectedSession<RpcComplianceServerApi, RpcComplianceClientApi>>;
}

/**
 * Composable server/client fixture that remains idle until explicit admission.
 *
 * @template Frame - Representation-native complete frame type.
 * @template Context - Per-frame transport metadata.
 */
export interface RpcTestSessionFixture<Frame = unknown, Context = unknown> {
  /** Fresh server facade. */
  readonly server: RpcServer<RpcComplianceClientApi, RpcComplianceServerApi>;

  /** Fresh client facade. */
  readonly client: RpcClient<RpcComplianceServerApi, RpcComplianceClientApi>;

  /** Controllable transport pair reserved for this fixture. */
  readonly transport: RpcAdversarialTransportPair<Frame, Context>;

  /** Deterministic scheduler owning fixture work. */
  readonly scheduler: RpcTestScheduler;

  /** Host-mediated finite-budget pressure controls. */
  readonly budget: RpcTestBudgetControl;

  /** Explicitly starts server admission and client connection together. */
  admit(options?: RpcSessionEstablishmentOptions): RpcTestSessionAttempt;

  /** Releases all fixture-owned resources after a case. */
  dispose(): Promise<void>;
}

/**
 * Factory for isolated foundation session fixtures.
 *
 * @template Frame - Representation-native complete frame type.
 * @template Context - Per-frame transport metadata.
 */
export interface RpcTestSessionFactory<Frame = unknown, Context = unknown> {
  /** Creates endpoints and transports without admitting or connecting them. */
  (options: RpcTestSessionFixtureOptions): RpcTestSessionFixture<Frame, Context>;
}

/** Normalized pending-work counts for one attempted or established session. */
export interface RpcTestPendingWorkSnapshot {
  /** Calls that have not fully settled. */
  readonly calls: number;

  /** Notifications queued or executing. */
  readonly notifications: number;

  /** Remote promises awaiting settlement. */
  readonly promises: number;

  /** Streams that have not reached terminal cleanup. */
  readonly streams: number;

  /** Plugin messages awaiting transport or handling. */
  readonly pluginMessages: number;
}

/** Immutable source-neutral inspection of one session lifecycle. */
export interface RpcTestSessionSnapshot {
  /** Current semantic lifecycle phase. */
  readonly phase: RpcTestLifecyclePhase;

  /** Whether compatibility succeeded for this attempt. */
  readonly compatible: boolean;

  /** Whether root authority was issued to the client. */
  readonly rootIssued: boolean;

  /** Current issued and received authority counts. */
  readonly authority: Readonly<{issued: number; received: number}>;

  /** Latest immutable contract-level resource observations, when established. */
  readonly resources?: RpcSessionResources;

  /** Normalized pending protocol and application work. */
  readonly pending: RpcTestPendingWorkSnapshot;

  /** Active transport subscriptions owned by RPC. */
  readonly transportSubscriptions: number;

  /** Pending scheduler tasks owned by this attempted session. */
  readonly schedulerTasks: number;

  /** Host-tracked plugin state entries. */
  readonly pluginState: number;
}

/** Source adapter for normalized session inspection. */
export interface RpcTestSessionInspector {
  /** Inspects an attempt or established public session without exposing internals. */
  inspect<RemoteApi extends object, LocalApi extends object>(
    target: RpcTestSessionAttempt | RpcSession<RemoteApi, LocalApi>,
  ): RpcTestSessionSnapshot;
}

/**
 * Aggregate factory and capability registry consumed by foundation compliance.
 *
 * @template Frame - Representation-native complete frame type.
 * @template Context - Per-frame transport metadata.
 */
export interface RpcComplianceTestSuite<Frame = unknown, Context = unknown> {
  /** Creates conventional server facades. */
  readonly createServer: RpcTestServerFactory;

  /** Creates conventional client facades. */
  readonly createClient: RpcTestClientFactory;

  /** Creates direction-neutral nodes. */
  readonly createNode: RpcTestNodeFactory;

  /** Creates explicit-admission server/client session fixtures. */
  readonly createSession: RpcTestSessionFactory<Frame, Context>;

  /** Creates controllable transport pairs. */
  readonly createTransportPair: RpcAdversarialTransportFactory<Frame, Context>;

  /** Creates telemetry for ownership scenarios. */
  readonly createTelemetry: RpcTestTelemetryFactory;

  /** Creates plugins for setup and cleanup scenarios. */
  readonly createPlugin: RpcTestPluginFactory;

  /** Creates isolated virtual schedulers. */
  readonly createScheduler: () => RpcTestScheduler;

  /** Produces normalized immutable session snapshots. */
  readonly sessionInspector: RpcTestSessionInspector;
}

/** Expected classification for an invalid protocol vector. */
export type RpcProtocolVectorFailure =
  | 'reject-operation'
  | 'reject-establishment'
  | 'terminate-session';

/**
 * Hand-authored canonical-message fixture independent of documentation output.
 *
 * @template Canonical - Source-neutral canonical in-memory message type.
 * @template StringFrame - Exact source-specific string representation.
 * @template RawFrame - Exact source-specific raw representation.
 */
export interface RpcProtocolVector<Canonical, StringFrame = string, RawFrame = unknown> {
  /** Stable human-readable vector name. */
  readonly name: string;

  /** Semantic message family owned by the future canonical model. */
  readonly family: string;

  /** Lifecycle phase in which the vector is valid or hostile. */
  readonly phase: RpcTestLifecyclePhase;

  /** Canonical in-memory value shared by representation adapters. */
  readonly canonical: Canonical;

  /** Optional exact string representation asserted by a source adapter. */
  readonly string?: StringFrame;

  /** Optional exact raw representation asserted by a source adapter. */
  readonly raw?: RawFrame;

  /** Expected failure when this vector is deliberately invalid. */
  readonly failure?: RpcProtocolVectorFailure;
}

/**
 * Source-specific representation adapter applied to shared protocol vectors.
 *
 * @template Canonical - Source-neutral canonical in-memory message type.
 * @template Frame - Exact source-specific frame representation.
 */
export interface RpcProtocolVectorAdapter<Canonical, Frame> {
  /** Encodes one canonical value into the source representation. */
  encode(value: Canonical): Frame;

  /** Decodes one source frame into the canonical in-memory model. */
  decode(frame: Frame): Canonical;
}
