# RPC Lifecycle and Resources

This document is part of the normative [RPC charter](./README.md).

## Calls, Notifications, and Delivery

- Calls are dispatched at most once for one accepted request within a live session.
- Automatic retry is absent by default. Middleware may initiate a new attempt only when application semantics permit duplicate execution.
- A lost result, timeout, or cancellation does not prove that owner-side work did not execute or commit side effects.
- Cancellation is cooperative and does not imply rollback.
- Notifications provide no application-level completion acknowledgement.
- Correlation identifiers are session-scoped, finite, and have safe exhaustion behavior.
- Duplicate, unknown, malformed, and late outcomes cannot corrupt pending work.
- RPC guarantees ordering only where a value kind defines it, such as items within one stream or updates within one signal. Independent calls, notifications, promises, streams, and signals have no global ordering guarantee.

## Disconnect, Reconnect, and Disposal

- Transport closure emits one typed closure event and settles one closure promise. Nonterminal transport failures emit typed error events.
- Transport closure, liveness failure, or explicit disconnect ends the current session.
- A publicly established session starts active, transitions through disposing during teardown, and ends disposed. Establishing and resumable-inactive sessions are not public states.
- Session termination stops ingress and new reservations, rejects pending calls and promises, cancels active work and streams, removes watches, detaches transport listeners, invalidates authority, and invokes every session-scoped plugin cleanup path with contained failures.
- Core teardown force-releases every host-tracked session and plugin lease independently of plugin cooperation. The closure promise settles only after session resource observations reach zero.
- Session disconnect is idempotent and converges with simultaneous transport closure or endpoint disposal without duplicate cleanup.
- Late frames from a terminated session have no effect on a later session.
- Reconnection creates a freshly admitted and negotiated session. Pending work and wire authority do not resume implicitly.
- A client exposes its root synchronously only after connection establishes the session and root. Access before readiness or while disconnected fails synchronously.
- Reconnection creates a fresh root facade. Owner-side values may survive according to retention policy and may be reissued later, but prior facades remain stale.
- Endpoint disposal is terminal and releases endpoint-owned sessions, timers, plugins, telemetry, and transport bindings according to ownership.
- Session and endpoint plugin setup and disposal use separate hook contexts. Session hooks receive only negotiated session capabilities; endpoint hooks receive only endpoint-scoped capabilities.
- Wire plugins remain protected through session cleanup. Protection never prevents terminal disposal.
- RPC always detaches transport subscriptions it created. Internally created resources are owned by RPC; caller-injected resources, including transports, remain caller-owned unless ownership transfer is explicit.

## Root Exposure Lifecycle

- Exposure changes commit atomically at the server boundary and propagate to existing sessions in committed order.
- Updating an exposure preserves that layer’s precedence. Removing an exposure is idempotent and reveals any earlier layer beneath it.
- Removing or replacing an exposed top-level property affects future root discovery but does not revoke already issued references or reroute operations already accepted.
- Disconnect stops root propagation to that session. A later connection receives the current root through a fresh session-scoped facade.

## Release and Retention

- Object and function references support deterministic early release through an operation separate from application members.
- Deterministic release synchronously invalidates the local facade, is idempotent at the consumer boundary, and produces at most one effective release request.
- Early reference release does not acknowledge domain resource closure. Applications expose an explicit remote operation when they require confirmed business cleanup.
- Garbage-collection finalization may accelerate release where available but is never required for correctness, security, or bounded resource use.
- Signals use observation lifecycle, promises use one-shot settlement, and streams use iterator lifecycle rather than object/function release semantics.
- Owner-side retention begins only after no live session retains authority to the value.
- Retention policies may reclaim values on disconnect, after finite idle time, or weakly.
- The root remains owner-managed and is not reclaimed as an ordinary remote reference.
- Endpoint disposal clears retained RPC bookkeeping regardless of retention policy.

## Finite Resources

- Every accepted session has immutable finite effective limits. Trusted, local, and in-process transports do not create an unbounded mode.
- Core categories have stable units of bytes, count, or depth. A maximum limits one frame or value graph without accumulating across independent operations; a capacity limits concurrently active, queued, or retained state through releasable leases. Plugin sub-budgets reserve capacity only; core categories enforce plugin frame, payload, and decode maxima.
- Core categories cover complete frame and semantic payload bytes, decoded depth and entries, pending calls and notifications, issued and received references by value kind, pending promises, active streams, buffered stream items and bytes, watches, queued updates, transferables, pending plugin messages, and aggregate plugin state.
- Resource-bearing operations acquire all required capacity atomically before allocating externally influenced state, dispatching work, issuing authority, or making a mutation visible. A failed acquisition changes no usage.
- Reservations are opaque session-bound leases. Release is idempotent, cannot reduce usage below zero, and cannot affect another or later session.
- Serialization, validation, middleware, send, transfer, and plugin-setup failure release every prepared reservation. Partial multi-category acquisition never remains committed.
- Cancellation releases prepared work immediately. Capacity for already dispatched application or plugin work remains reserved until that work actually settles or terminal teardown reclaims its session bookkeeping; caller settlement alone does not prove execution stopped.
- String representation cost uses encoded bytes or a documented conservative upper bound. Raw representation cost uses a documented side-effect-free structural rule that includes traversed entries, strings, binary backing sizes, and transferables; JSON serialization is not a raw-size estimator.
- Byte accounting never replaces independent depth and decoded-entry maxima. Conservative accounting may overcharge but must not omit framing, plugin qualification, or representation-owned payload overhead.
- Recoverable local or peer pressure rejects the affected operation without committing authority or state. A terminal exhaustion result means RPC has already begun host-owned teardown. Structural-limit, flow-control, namespace, malformed-input, or accounting-integrity violations terminate the offending session when safe isolated continuation is not possible.
- Session-fatal exhaustion does not mutate another session's ledger. Per-session limits alone do not guarantee endpoint-wide memory, admission, scheduling, or sustained-traffic isolation.
- Session teardown releases every reservation deterministically and reaches zero in every category before closure completes.
