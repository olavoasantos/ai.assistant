import type {ApplicationError} from '../error';
import type {EventEmitter} from '../events';
import type {
  RpcSessionBudgetCompatibility,
  RpcSessionBudgetOffer,
  RpcSessionResources,
} from './budgets';
import type {RpcWirePluginCompatibility} from './plugins';
import type {
  RpcCallback,
  RpcCopy,
  RpcModel,
  RpcModelInspector,
  RpcModelMetadata,
  RpcReference,
  RpcReferenceReleaser,
  RpcRemote,
  RpcRemoteModel,
  RpcRemotePromise,
  RpcRemoteReference,
  RpcRemoteRoot,
  RpcStream,
  RpcUnsupportedValue,
  RpcValueProjections,
} from './values';

export type * from './budgets';
export type * from './plugins';

export type {
  RpcCallback,
  RpcCopy,
  RpcModel,
  RpcModelInspector,
  RpcModelMetadata,
  RpcReference,
  RpcReferenceReleaser,
  RpcRemote,
  RpcRemoteModel,
  RpcRemotePromise,
  RpcRemoteReference,
  RpcRemoteRoot,
  RpcStream,
  RpcUnsupportedValue,
  RpcValueProjections,
};

/**
 * A read-only subset of an API that can occupy one server exposure layer.
 *
 * Exposure fragments are shallow: each supplied top-level property replaces
 * that property in the layer as one atomic value.
 *
 * @template LocalApi - The complete API shape owned by the exposing node.
 */
export type RpcApiFragment<LocalApi extends object = Record<string, unknown>> = Readonly<
  Partial<LocalApi>
>;

/**
 * A removable layer in a server's live root capability directory.
 *
 * Updating a layer preserves its precedence. Removing it is idempotent and
 * reveals any earlier layer beneath it; references already issued from the
 * removed layer remain governed by their session authority.
 *
 * @template LocalApi - The complete API shape to which this layer contributes.
 */
export interface RpcExposure<LocalApi extends object = Record<string, unknown>> {
  /** The current read-only shallow snapshot of this layer's exposed properties. */
  readonly value: RpcApiFragment<LocalApi>;

  /** Whether this layer still contributes to the root directory. */
  readonly active: boolean;

  /**
   * Atomically merges properties into this layer without changing precedence.
   *
   * @param value - The top-level properties to replace in the layer.
   * @returns This exposure for fluent mutation.
   * @throws When the exposure has already been removed.
   */
  setMany(value: RpcApiFragment<LocalApi>): this;

  /**
   * Removes this layer from the root directory.
   *
   * Repeated removal is a safe no-op.
   */
  remove(): void;
}

/** The representation carried by an RPC transport. */
export type RpcTransportRepresentation = 'string' | 'raw';

/** The party responsible for terminally disposing an attached transport. */
export type RpcTransportOwnership = 'caller' | 'rpc';

/**
 * Environment-agnostic ownership-transfer metadata for one raw frame.
 *
 * The contract does not depend on an environment-specific transfer interface.
 * Each transport chooses the values its environment can transfer.
 *
 * @template Transfer - A value supported by the transport's transfer mechanism.
 */
export interface RpcTransferContext<Transfer = unknown> {
  /** Values whose ownership accompanies the frame. */
  readonly transfers?: readonly Transfer[];
}

/**
 * One complete frame delivered by an RPC transport subscription.
 *
 * @template Frame - The complete frame representation delivered by the transport.
 * @template Context - Per-frame transport metadata.
 */
export interface RpcTransportDelivery<Frame = unknown, Context = undefined> {
  /** The complete inbound frame. */
  readonly frame: Frame;

  /** Representation-specific metadata accompanying the frame. */
  readonly context: Context;
}

/** Information reported when a transport closes. */
export interface RpcTransportClosure {
  /** A diagnostic reason for closure, when one is available. */
  readonly reason?: unknown;
}

/** Events emitted by an RPC transport. */
export interface RpcTransportEventMap {
  /** A normalized nonterminal transport failure. */
  'rpc:transport.errored': ApplicationError;

  /** Terminal transport closure. */
  'rpc:transport.closed': RpcTransportClosure;
}

/**
 * A structural transport that moves complete RPC frames.
 *
 * Implementations require no ecosystem base class. Readiness must settle
 * before RPC negotiation begins, sends may apply asynchronous backpressure,
 * and every subscription returns its own cleanup function. Errors and closure
 * use the inherited typed event API.
 *
 * @template Frame - The complete frame representation moved by the transport.
 * @template Context - Per-frame transport metadata.
 */
export interface RpcTransport<
  Frame = unknown,
  Context = undefined,
> extends EventEmitter<RpcTransportEventMap> {
  /** The frame representation implemented by this transport. */
  readonly representation: RpcTransportRepresentation;

  /** Settles when the transport can send and receive frames. */
  readonly ready: Promise<void>;

  /** Settles exactly once with terminal transport closure information. */
  readonly closed: Promise<RpcTransportClosure>;

  /**
   * Sends one complete frame.
   *
   * @param frame - The complete frame to send.
   * @param context - Optional representation-specific transport metadata.
   * @returns Nothing, or a promise that settles after transport backpressure.
   */
  send(frame: Frame, context?: Context): void | Promise<void>;

  /**
   * Subscribes to complete inbound frame deliveries.
   *
   * Listener failures must not escape into transport delivery or prevent other
   * transport and session cleanup.
   *
   * @param listener - The callback invoked with each complete frame delivery.
   * @returns A function that removes this subscription.
   */
  subscribe(listener: (delivery: RpcTransportDelivery<Frame, Context>) => void): () => void;

  /**
   * Terminally releases resources owned by this transport.
   *
   * RPC invokes this only when transport ownership was transferred explicitly.
   * Disposal of an open transport produces its one terminal closure outcome.
   * After disposal, every public operation, including repeated disposal, throws
   * or returns a rejected promise.
   */
  dispose(): void | Promise<void>;
}

/** A transport that moves complete string frames. */
export interface RpcStringTransport extends RpcTransport<string, undefined> {
  /** The string representation discriminator. */
  readonly representation: 'string';
}

/**
 * A transport that moves complete structured frames with optional transfers.
 *
 * @template Frame - The structured frame type understood by the transport.
 * @template Transfer - A value supported by the transport's transfer mechanism.
 */
export interface RpcRawTransport<Frame = unknown, Transfer = unknown> extends RpcTransport<
  Frame,
  RpcTransferContext<Transfer>
> {
  /** The raw representation discriminator. */
  readonly representation: 'raw';
}

/** Options for establishing an RPC session over a transport. */
export interface RpcSessionEstablishmentOptions {
  /** Cancels transport readiness, compatibility, and root establishment. */
  readonly signal?: AbortSignal;

  /**
   * The party responsible for terminal transport disposal.
   *
   * RPC always detaches its subscriptions. With the default `caller` ownership,
   * session teardown does not invoke `transport.dispose()`.
   *
   * @defaultValue 'caller'
   */
  readonly ownership?: RpcTransportOwnership;

  /**
   * Finite local resource limits offered for the new session.
   *
   * Omission selects implementation-defined finite defaults. It never selects
   * an unbounded mode, including for trusted or in-process transports.
   */
  readonly budget?: RpcSessionBudgetOffer;
}

/** Immutable compatibility established for one RPC session. */
export interface RpcCompatibility {
  /** The opaque protocol version or compatibility identifier agreed by both nodes. */
  readonly protocol: string;

  /** The transport representation used by the session. */
  readonly representation: RpcTransportRepresentation;

  /** Immutable active wire-plugin selections for this session. */
  readonly plugins: readonly RpcWirePluginCompatibility[];

  /** Immutable effective core and wire-plugin resource limits. */
  readonly budget: RpcSessionBudgetCompatibility;
}

/** Aggregate authority observations for one session. */
export interface RpcSessionAuthority {
  /** The number of local references issued to the remote node. */
  readonly issued: number;

  /** The number of remote references received by the local node. */
  readonly received: number;
}

/** The current lifecycle state of an established RPC session. */
export type RpcSessionStatus = 'active' | 'disposing' | 'disposed';

/** The source that initiated terminal session closure. */
export type RpcSessionClosureSource = 'local' | 'remote' | 'transport';

/** Information produced exactly once when an RPC session closes. */
export interface RpcSessionClosure {
  /** The boundary that initiated closure. */
  readonly source: RpcSessionClosureSource;

  /** A diagnostic reason for closure, when one is available. */
  readonly reason?: unknown;
}

/**
 * Details emitted after an RPC session has closed.
 *
 * @template RemoteApi - The unprojected API shape owned by the remote node.
 * @template LocalApi - The complete API shape owned by the local node.
 */
export interface RpcSessionClosedDetails<
  RemoteApi extends object = Record<string, unknown>,
  LocalApi extends object = Record<string, unknown>,
> {
  /** The session whose teardown completed. */
  readonly session: RpcSession<RemoteApi, LocalApi>;

  /** The session's terminal closure information. */
  readonly closure: RpcSessionClosure;
}

/**
 * Transport and lifecycle events observable from an RPC session.
 *
 * @template RemoteApi - The unprojected API shape owned by the remote node.
 * @template LocalApi - The complete API shape owned by the local node.
 */
export interface RpcSessionEventMap<
  RemoteApi extends object = Record<string, unknown>,
  LocalApi extends object = Record<string, unknown>,
> extends RpcTransportEventMap {
  /** Session teardown has completed. */
  'rpc:session.closed': RpcSessionClosedDetails<RemoteApi, LocalApi>;
}

/**
 * Node events, including lifecycle events bubbled from owned sessions.
 *
 * @template RemoteApi - The unprojected API shape owned by remote nodes.
 * @template LocalApi - The complete API shape owned by the node.
 */
export interface RpcNodeEventMap<
  RemoteApi extends object = Record<string, unknown>,
  LocalApi extends object = Record<string, unknown>,
> extends RpcSessionEventMap<RemoteApi, LocalApi> {
  /** An incoming session has completed establishment. */
  'rpc:session.accepted': RpcSession<RemoteApi, LocalApi>;

  /** An outgoing session and its remote root have completed establishment. */
  'rpc:session.connected': RpcConnectedSession<RemoteApi, LocalApi>;
}

/**
 * Events observable from an RPC server, including bubbled node events.
 *
 * @template RemoteApi - The unprojected API shape owned by connected clients.
 * @template LocalApi - The complete API shape owned by the server.
 */
export interface RpcServerEventMap<
  RemoteApi extends object = Record<string, unknown>,
  LocalApi extends object = Record<string, unknown>,
> extends RpcNodeEventMap<RemoteApi, LocalApi> {
  //
}

/**
 * Events observable from an RPC client, including bubbled node events.
 *
 * @template RemoteApi - The unprojected API shape owned by the server.
 * @template LocalApi - The complete API shape owned by the client.
 */
export interface RpcClientEventMap<
  RemoteApi extends object = Record<string, unknown>,
  LocalApi extends object = Record<string, unknown>,
> extends RpcNodeEventMap<RemoteApi, LocalApi> {
  //
}

/**
 * One live, authority-scoped relationship between two RPC nodes.
 *
 * Session establishment is atomic, so a public session starts in the `active`
 * state. Disconnect is intentionally idempotent and race-safe because local
 * teardown may coincide with transport or remote closure. Transport events
 * bubble through the session while current status and `closed` remain authoritative.
 *
 * @template RemoteApi - The unprojected API shape owned by the remote node.
 * @template LocalApi - The complete API shape owned by the local node.
 */
export interface RpcSession<
  RemoteApi extends object = Record<string, unknown>,
  LocalApi extends object = Record<string, unknown>,
> extends EventEmitter<RpcSessionEventMap<RemoteApi, LocalApi>> {
  /** The endpoint-scoped local node participating in this session. */
  readonly node: RpcNode<RemoteApi, LocalApi>;

  /** The authoritative current lifecycle state. */
  readonly status: RpcSessionStatus;

  /** The immutable compatibility negotiated during establishment. */
  readonly compatibility: RpcCompatibility;

  /** The latest immutable aggregate authority observation. */
  readonly authority: RpcSessionAuthority;

  /** The latest immutable resource observations. */
  readonly resources: RpcSessionResources;

  /** Aborts when this session begins terminal teardown. */
  readonly signal: AbortSignal;

  /** Settles exactly once when session teardown completes. */
  readonly closed: Promise<RpcSessionClosure>;

  /**
   * Ends this session and all of its pending work without disposing its node.
   *
   * @param reason - Optional diagnostic context for local closure.
   */
  disconnect(reason?: unknown): Promise<void>;
}

/**
 * An outgoing RPC session whose remote root is synchronously available.
 *
 * The root facade belongs only to this session. It becomes stale after
 * disconnect and is never rebound when an endpoint reconnects.
 *
 * @template RemoteApi - The unprojected API shape owned by the remote node.
 * @template LocalApi - The complete API shape owned by the local node.
 */
export interface RpcConnectedSession<
  RemoteApi extends object,
  LocalApi extends object = Record<string, unknown>,
> extends RpcSession<RemoteApi, LocalApi> {
  /** The live, session-scoped projection of the remote node's root. */
  readonly root: RpcRemoteRoot<RemoteApi>;
}

/**
 * An endpoint-scoped, direction-neutral participant in the RPC graph.
 *
 * A node may own several independent sessions. Session and transport events
 * bubble through the node. It exposes no wire reference identifiers,
 * owner-side values, or mutable authority registries.
 *
 * @template RemoteApi - The unprojected API shape owned by remote nodes.
 * @template LocalApi - The complete API shape owned by this node.
 */
export interface RpcNode<
  RemoteApi extends object = Record<string, unknown>,
  LocalApi extends object = Record<string, unknown>,
> extends EventEmitter<RpcNodeEventMap<RemoteApi, LocalApi>> {
  /** The active sessions owned by this node. */
  readonly sessions: ReadonlySet<RpcSession<RemoteApi, LocalApi>>;

  /**
   * Adds one live layer to this node's local root directory.
   *
   * @param value - The API fragment supplied by the new layer.
   * @returns A handle for atomically updating or removing the layer.
   */
  expose(value: RpcApiFragment<LocalApi>): RpcExposure<LocalApi>;

  /**
   * Accepts an already application-approved incoming transport.
   *
   * The promise resolves only after readiness and compatibility establish a
   * usable session. RPC performs no authentication or admission policy.
   *
   * @param transport - The structural transport to accept.
   * @param options - Establishment cancellation and transport ownership.
   * @returns The established incoming session.
   */
  accept(
    transport: RpcTransport<unknown, unknown>,
    options?: RpcSessionEstablishmentOptions,
  ): Promise<RpcSession<RemoteApi, LocalApi>>;

  /**
   * Establishes an outgoing session and its remote root.
   *
   * @param transport - The structural transport over which to connect.
   * @param options - Establishment cancellation and transport ownership.
   * @returns The established outgoing session with a synchronous root.
   */
  connect(
    transport: RpcTransport<unknown, unknown>,
    options?: RpcSessionEstablishmentOptions,
  ): Promise<RpcConnectedSession<RemoteApi, LocalApi>>;

  /**
   * Disconnects one session owned by this node.
   *
   * @param session - The session to disconnect.
   * @param reason - Optional diagnostic context for local closure.
   */
  disconnect(session: RpcSession<RemoteApi, LocalApi>, reason?: unknown): Promise<void>;

  /**
   * Terminally disconnects all sessions and releases node-owned resources.
   *
   * After disposal, every public operation, including repeated disposal, throws
   * or returns a rejected promise.
   */
  dispose(): Promise<void>;
}

/**
 * The conventional bootstrap-root owner and incoming-session facade.
 *
 * Events from the server's node, sessions, and transports bubble through this
 * facade. Generic order remains relative to the local server endpoint.
 *
 * @template RemoteApi - The unprojected API shape owned by connected clients.
 * @template LocalApi - The complete API shape owned and exposed by the server.
 */
export interface RpcServer<
  RemoteApi extends object = Record<string, unknown>,
  LocalApi extends object = Record<string, unknown>,
> extends EventEmitter<RpcServerEventMap<RemoteApi, LocalApi>> {
  /** The direction-neutral node facing client APIs from the server endpoint. */
  readonly node: RpcNode<RemoteApi, LocalApi>;

  /** The server's active accepted sessions. */
  readonly sessions: ReadonlySet<RpcSession<RemoteApi, LocalApi>>;

  /**
   * Adds one live layer to the server root capability directory.
   *
   * @param value - The server-owned API fragment supplied by the new layer.
   * @returns A handle for atomically updating or removing the layer.
   */
  expose(value: RpcApiFragment<LocalApi>): RpcExposure<LocalApi>;

  /**
   * Admits an already authenticated and application-approved transport.
   *
   * @param transport - The structural transport to admit.
   * @param options - Establishment cancellation and transport ownership.
   * @returns The established server-side session facing the client API.
   */
  admit(
    transport: RpcTransport<unknown, unknown>,
    options?: RpcSessionEstablishmentOptions,
  ): Promise<RpcSession<RemoteApi, LocalApi>>;

  /**
   * Terminally disconnects every session and releases server-owned resources.
   *
   * After disposal, every public operation, including repeated disposal, throws
   * or returns a rejected promise.
   */
  dispose(): Promise<void>;
}

/**
 * The conventional outgoing-session and projected remote-root facade.
 *
 * Events from the client's node, sessions, and transports bubble through this
 * facade. Generic order remains relative to the local client endpoint.
 *
 * @template RemoteApi - The unprojected API shape owned by the server.
 * @template LocalApi - The complete API shape owned by the client.
 */
export interface RpcClient<
  RemoteApi extends object = Record<string, unknown>,
  LocalApi extends object = Record<string, unknown>,
> extends EventEmitter<RpcClientEventMap<RemoteApi, LocalApi>> {
  /** The direction-neutral node facing the server API from this client. */
  readonly node: RpcNode<RemoteApi, LocalApi>;

  /** The current established session, or `undefined` while disconnected. */
  readonly session: RpcConnectedSession<RemoteApi, LocalApi> | undefined;

  /**
   * The current session's synchronous projection of the server root.
   *
   * @throws Before connection readiness, while disconnected, or after disposal.
   */
  readonly root: RpcRemoteRoot<RemoteApi>;

  /**
   * Establishes the client's first current session.
   *
   * The promise resolves only after transport readiness, compatibility, and root
   * establishment. It does not queue root operations before readiness and rejects
   * when a current session has not fully closed; use {@link reconnect} to replace
   * a current session explicitly.
   *
   * @param transport - The structural transport over which to connect.
   * @param options - Establishment cancellation and transport ownership.
   * @returns The fresh established session.
   */
  connect(
    transport: RpcTransport<unknown, unknown>,
    options?: RpcSessionEstablishmentOptions,
  ): Promise<RpcConnectedSession<RemoteApi, LocalApi>>;

  /**
   * Ends any current session and establishes a fresh session and root facade.
   *
   * Pending work, authority, and old facades never resume or rebind.
   *
   * @param transport - The structural transport over which to reconnect.
   * @param options - Establishment cancellation and transport ownership.
   * @returns The fresh established session.
   */
  reconnect(
    transport: RpcTransport<unknown, unknown>,
    options?: RpcSessionEstablishmentOptions,
  ): Promise<RpcConnectedSession<RemoteApi, LocalApi>>;

  /**
   * Idempotently disconnects the current session without disposing the client.
   *
   * @param reason - Optional diagnostic context for local closure.
   */
  disconnect(reason?: unknown): Promise<void>;

  /**
   * Terminally disconnects the current session and releases client-owned resources.
   *
   * After disposal, every public operation, including repeated disposal, throws
   * or returns a rejected promise.
   */
  dispose(): Promise<void>;
}
