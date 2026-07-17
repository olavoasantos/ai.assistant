# Charter — RPC

## Purpose

Provide the platform’s default foundation for remote communication across execution boundaries. RPC lets a client use a server-owned root and exchange rich values without coupling application code to a particular transport, while preserving the latency, partial failure, authority, and lifecycle realities of remote execution.

## What It Is

- A remote-call system for applications, processes, workers, frames, and services.
- A remote-capability graph: the server root is the bootstrap authority, and references reachable from exchanged values may delegate further authority.
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

### Server

A server owns a live root capability directory and admits transports that the application has already authenticated and approved. It may support multiple sessions concurrently. Each session has independent authority, work, plugins, resources, and cleanup even when sessions receive references to the same owner-side value.

Server describes bootstrap-root ownership and admission, not a deployment environment. A server may run in an application, process, worker, frame, or service.

### Client

A client establishes one current session and uses the server’s remote root. It may issue its own local values as remote references when passing callbacks or other rich values to the server. It does not expose a second root merely to support bidirectional behavior.

Client describes session initiation and root consumption, not one-directional remote behavior.

### Node

A node is an endpoint-scoped, direction-neutral RPC participant. A node can issue local references, hydrate references owned by remote nodes, initiate operations on received references, and settle operations initiated by remote nodes. One node may participate in multiple sessions without sharing authority or session state between them.

Servers and clients provide conventional bootstrap topology over node behavior. Advanced integrations may use node admission and connection directly without changing session symmetry.

### Session

A session is one live relationship between two nodes. Transports, sessions, nodes, servers, and clients participate in the typed ecosystem event hierarchy while status and closure promises remain authoritative lifecycle truth. A session owns:

- negotiated protocol and wire-plugin compatibility;
- issued and received authority;
- pending calls, promises, streams, and cancellations;
- session-scoped plugin state;
- finite resource accounting;
- transport bindings and terminal cleanup.

Disconnect ends the session. A later connection is a new session, even when it connects the same applications or reissues references to the same owner-side values.

### Transport

A transport moves complete RPC frames after application admission. It reports readiness and one-shot closure through promises, delivers inbound frames through single-value subscriptions, and reports failures and closure through typed ecosystem events. RPC supports:

- string representations for WebSocket, byte streams, and similar boundaries;
- raw representations for structured-clone boundaries such as Worker and MessagePort.

Raw transports may transfer supported values by ownership. Transfer metadata is a transport concern and never grants remote-reference authority.

Transports do not define RPC authentication, application methods, value identity, retry, or cleanup policy beyond the resources they own. RPC detaches every subscription it creates. A caller-injected transport remains caller-owned unless ownership is transferred explicitly; only an owned transport is terminally disposed by RPC.

### Root Exposures and Remote References

The root is a live capability directory and the first remote authority a server issues to an accepted client session. A server builds it from exposure layers. Each exposure owns one removable layer and may atomically replace several top-level properties without changing its precedence. The latest remaining exposure for a top-level property is visible; removing it reveals the next layer beneath it.

Committed root changes propagate to existing sessions through their current root facade. Removing an exposure prevents future discovery of its top-level properties through that layer but does not revoke references already issued from it. Exposure removal is idempotent, and exposure changes do not reroute operations already accepted against earlier authority.

A remote reference designates an owner-side value and grants only the receiving session permission to perform the operations defined for that value kind. References may appear in arguments, results, notifications, object snapshots, callback traffic, promise settlements, stream items, reactive updates, and plugin-defined values. Transmitting a reference deliberately delegates its authority to the receiving session.

### Remote Values and Calls

A remote value is a value whose wire behavior is defined by RPC core or a negotiated plugin. It may cross by copy or designate owner-side state through a remote reference.

A call requests one invocation of an authorized method or function and correlates it with one eventual result or failure. Notifications request invocation without an application-level result. Promises and streams represent deferred one-shot and ordered multi-item outcomes respectively.

### Plugins

RPC plugins are ordinary ecosystem plugins with RPC-specific hooks. One plugin object may combine value handling, semantic middleware, lifecycle, observation, and cleanup. Its generic plugin context remains generic; each RPC hook receives a phase-specific least-capability context.

A plugin is wire-affecting only when it carries a wire descriptor. The descriptor declares a stable plugin identifier, locally preferred opaque protocol identifiers, required or optional status, and plugin-local value and message namespaces. Effective namespaces are qualified by the stable plugin identifier and cannot impersonate core or another plugin. Package versions and semver ranges are not wire protocols.

Compatibility activates a wire plugin only when both peers declare the identifier and share a protocol identifier. A missing or incompatible required plugin rejects establishment before root delivery; an optional plugin without a common protocol remains inactive. Descriptor-free plugins are local-only and do not alter compatibility even when they provide middleware or observers.

RPC automatically installs core remote-value behavior as ordinary mandatory plugins. After compatibility, the session protects every core and active wire plugin as a whole object while descriptor-free local plugins remain dynamically addable and removable. Changing endpoint wire configuration affects future sessions, never an established session's negotiated membership.

### Session Budget

Every session has one finite resource budget. The budget accounts for all resource-bearing protocol and plugin behavior, including frames, decoded structures, pending work, remote references, streams, buffering, watches, updates, transferables, and plugin-owned state.

A budget is an authority boundary as well as an operational limit: one session cannot reserve, release, or observe another session’s allocation.

## Foundational Invariants

- RPC sends no frames and discloses no root or application value before application admission and successful compatibility establishment.
- Authority begins with the issued root and extends only through references deliberately transmitted to a live session.
- Every reference operation verifies live-session authority.
- Remote value kinds retain distinct type projection, identity, delivery, ordering, release, and cleanup semantics in either ownership direction.
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
