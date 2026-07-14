# Charter — RPC

## Purpose

Provide the platform’s default foundation for remote communication across execution boundaries. RPC lets a consumer use a provider-owned root and exchange rich values without coupling application code to a particular transport, while preserving the latency, partial failure, authority, and lifecycle realities of remote execution.

## What It Is

- A remote-call system for applications, processes, workers, frames, and services.
- A remote-capability graph: the provider root is the bootstrap authority, and references reachable from exchanged values may delegate further authority.
- A rich-value system supporting copied data, remote objects/models, functions, pending promises, streams, and plugin-defined values.
- A session system with explicit compatibility, cancellation, resource accounting, disconnect, and cleanup semantics.
- A transport-independent system with equivalent behavior over string and structured-clone representations.
- An ecosystem plugin-engine extension system for value handling, middleware, lifecycle, and observation.

## What It Is Not

- Not local procedure calls with hidden networking. Remote work remains subject to latency and partial failure.
- Not an authentication system. Applications authenticate and approve transports before admitting them to RPC.
- Not a global object registry. Remote authority exists only within the session that received a reference.
- Not a static capability manifest maintained alongside the reachable object graph.
- Not automatic synchronization for every object property. Plain data and object snapshots cross by copy unless a remote value type defines ongoing updates.
- Not a retry or transaction system. Timeout and cancellation do not imply rollback, and automatic replay is absent by default.
- Not an application lifecycle, rendering, or service-container base class.

## Charter Documents

This entry point and the following documents together form the normative RPC charter:

- [Authority and safety](./authority.md) — admission, compatibility, reachability, member exposure, and hostile input.
- [Remote values](./values.md) — copied values, objects/models, functions, promises, streams, plugin values, and Preact Signals.
- [Lifecycle and resources](./lifecycle.md) — delivery, cancellation, disconnect, reconnect, release, retention, and finite budgets.
- [Extensions and ecosystem integration](./extensions.md) — plugin execution, observation, errors, validation, events, telemetry, Signals, and Executable boundaries.

## Entities

### Provider

A provider owns the root value and admits transports that the application has already authenticated and approved. It may support multiple sessions concurrently. Each session has independent authority, work, plugins, resources, and cleanup even when sessions receive references to the same owner-side value.

The provider/consumer distinction describes connection topology and root ownership. It does not make remote reference behavior one-directional.

### Consumer

A consumer establishes one session and uses the provider’s remote root. It may issue its own local values as remote references when passing callbacks or other rich values to the provider. It does not expose a second root merely to support bidirectional behavior.

### Session and Peers

A session is one live relationship between two peers. Each peer can issue local references, hydrate references owned by the other peer, initiate operations on references it has received, and settle operations initiated by the other peer.

A session owns:

- negotiated protocol and wire-plugin compatibility;
- issued and received authority;
- pending calls, promises, streams, and cancellations;
- session-scoped plugin state;
- finite resource accounting;
- transport bindings and terminal cleanup.

Disconnect ends the session. A later connection is a new session, even when it connects the same applications or reissues references to the same owner-side values.

### Transport

A transport moves complete RPC frames after application admission and reports readiness, inbound data, errors, closure, and cleanup. RPC supports:

- string representations for WebSocket, byte streams, and similar boundaries;
- raw representations for structured-clone boundaries such as Worker and MessagePort.

Raw transports may transfer supported values by ownership. Transfer metadata is a transport concern and never grants remote-reference authority.

Transports do not define RPC authentication, application methods, value identity, retry, or cleanup policy beyond the resources they own.

### Root and Remote References

The root is the first remote authority a provider issues to an accepted consumer session. A remote reference designates an owner-side value and grants only the receiving session permission to perform the operations defined for that value kind.

References may appear in arguments, results, notifications, object snapshots, callback traffic, promise settlements, stream items, reactive updates, and plugin-defined values. Transmitting a reference deliberately delegates its authority to the receiving session.

### Remote Values and Calls

A remote value is a value whose wire behavior is defined by RPC core or a negotiated plugin. It may cross by copy or designate owner-side state through a remote reference.

A call requests one invocation of an authorized method or function and correlates it with one eventual result or failure. Notifications request invocation without an application-level result. Promises and streams represent deferred one-shot and ordered multi-item outcomes respectively.

### Plugins

RPC plugins are ordinary ecosystem plugins with RPC-specific hooks. Plugins may participate in value matching, serialization, hydration, middleware, compatibility, lifecycle, observation, and cleanup.

A wire-affecting plugin changes values or messages understood by the peer. It therefore declares stable compatibility information and participates in session negotiation. Local-only middleware and observers do not affect wire compatibility.

### Session Budget

Every session has one finite resource budget. The budget accounts for all resource-bearing protocol and plugin behavior, including frames, decoded structures, pending work, remote references, streams, buffering, watches, updates, transferables, and plugin-owned state.

A budget is an authority boundary as well as an operational limit: one session cannot reserve, release, or observe another session’s allocation.

## Foundational Invariants

- RPC sends no frames and discloses no root or application value before application admission and successful compatibility establishment.
- Authority begins with the issued root and extends only through references deliberately transmitted to a live session.
- Every reference operation verifies live-session authority.
- Remote value kinds retain distinct identity, delivery, ordering, release, and cleanup semantics.
- Timeout and cancellation do not imply rollback or prove that owner-side effects did not occur.
- Disconnect invalidates session authority and settles or cleans up all session work. Reconnection creates a new session.
- Every accepted session has finite limits, including trusted and in-process sessions.
- Plugins cannot bypass core authority, validation, resource, or cleanup guarantees.
- Garbage-collection finalization is a release optimization and is never required for correctness or bounded resource use.

## Constraints

- RPC contracts and core behavior remain environment-agnostic.
- Concrete browser, worker, process, and testing transports live behind environment-appropriate boundaries.
- TypeScript types are explicit; runtime validation does not define them through inference.
- Rich-value behavior is implementation-independent even when a default implementation uses proxies, brands, caches, or compact framing.
- Security and resource guarantees apply equally to string and raw representations.
- Compliance tests operate below normal consumers where required to forge hostile frames and references.

## Deferred Scope

The initial RPC foundation does not include:

- remote constructor invocation;
- federation, upstream aggregation, or transparent relays;
- bundled collection codecs beyond values required by the platform;
- automatic retry or exactly-once execution;
- transaction or rollback semantics;
- compatibility with predecessor public APIs or wire formats.

Deferred capabilities require explicit charter and contract changes before becoming supported behavior.
