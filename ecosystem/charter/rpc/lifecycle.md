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
- Session termination rejects pending calls and promises, cancels active work and streams, removes watches, detaches transport listeners, disposes session plugin state, invalidates authority, and releases budget.
- Session disconnect is idempotent and converges with simultaneous transport closure or endpoint disposal without duplicate cleanup.
- Late frames from a terminated session have no effect on a later session.
- Reconnection creates a freshly admitted and negotiated session. Pending work and wire authority do not resume implicitly.
- A client exposes its root synchronously only after connection establishes the session and root. Access before readiness or while disconnected fails synchronously.
- Reconnection creates a fresh root facade. Owner-side values may survive according to retention policy and may be reissued later, but prior facades remain stale.
- Endpoint disposal is terminal and releases endpoint-owned sessions, timers, plugins, telemetry, and transport bindings according to ownership.
- RPC always detaches transport subscriptions it created. Internally created resources are owned by RPC; caller-injected resources, including transports, remain caller-owned unless ownership transfer is explicit.

## Root Exposure Lifecycle

- Exposure changes commit atomically at the server boundary and propagate to existing sessions in committed order.
- Updating an exposure preserves that layer’s precedence. Removing an exposure is idempotent and reveals any earlier layer beneath it.
- Removing or replacing an exposed top-level property affects future root discovery but does not revoke already issued references or reroute operations already accepted.
- Disconnect stops root propagation to that session. A later connection receives the current root through a fresh session-scoped facade.

## Release and Retention

- Object and function references support deterministic early release.
- Deterministic release is idempotent at the consumer boundary and produces at most one effective release.
- Garbage-collection finalization may accelerate release where available but is never required for correctness, security, or bounded resource use.
- Signals use observation lifecycle, promises use one-shot settlement, and streams use iterator lifecycle rather than object/function release semantics.
- Owner-side retention begins only after no live session retains authority to the value.
- Retention policies may reclaim values on disconnect, after finite idle time, or weakly.
- The root remains owner-managed and is not reclaimed as an ordinary remote reference.
- Endpoint disposal clears retained RPC bookkeeping regardless of retention policy.

## Finite Resources

- Every accepted session has finite effective limits. Trusted, local, and in-process transports do not create an unbounded mode.
- Resource-bearing operations reserve capacity before committing state and release it on settlement or cleanup.
- Failed or cancelled operations roll back partial reservations.
- Budget categories include representation size, decoded depth and collections, calls, notifications, references by kind, promises, streams, buffered items and bytes, watches, updates, transferables, and plugin state where applicable.
- Representation-specific accounting may be conservative rather than exact, but its units and behavior are stable and documented.
- Budget exhaustion rejects the operation or terminates the session according to severity without compromising other sessions.
- Usage cannot become negative, exceed negotiated limits, or be released by another session.
- Session teardown releases every reservation deterministically.
