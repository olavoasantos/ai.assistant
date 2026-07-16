# RPC Remote Values

This document is part of the normative [RPC charter](./README.md).

## Root Capability Directory

- A client session receives one stable root facade after connection establishes readiness.
- The facade is live within that session: committed server exposure changes update future root-path resolution without replacing the facade.
- Root updates preserve committed order. Missing or invalid updates trigger bounded recovery or session termination rather than uncertain authority.
- A top-level root property may designate copied data or remote references according to its value kind.
- Exposure replacement or removal does not mutate copied values already received or revoke remote references already issued.
- Consumer types project root methods and nested operations according to their remote value kinds while the root itself remains owner-managed and not ordinarily releasable.
- A root facade belongs to exactly one session and remains stale after disconnect, even when the client reconnects to the same server.

## Values by Copy

- Primitive values, arrays, and plain data records cross by copy unless a negotiated wire plugin handles them differently.
- Copied values have no ongoing remote identity, mutation, or synchronization relationship.
- Consumer types expose copied values recursively as read-only. Local editing begins from an explicit local clone and never implies owner-side mutation.
- Repeated occurrences of a copied value do not promise reference equality after hydration.
- Nested remote references retain their own identity and authority semantics.
- Explicit copy intent may distinguish a copied container with nested references from an identity-bearing behavior object.
- Cyclic or unsupported copied graphs fail with a clear type-level or runtime outcome unless a negotiated value kind explicitly represents them.
- String and raw transports may support different copied platform values, but those representation differences do not change remote-reference semantics.

## Objects and Models

- Behavior-bearing objects and named models may cross as remote references. Explicit reference or model intent disambiguates data-only objects whose runtime identity cannot be inferred safely.
- Repeated references to the same owner-side object resolve to one hydrated identity while the receiving session retains that reference.
- The first reference may carry a safe snapshot of non-reactive data so consumers can read it immediately.
- Snapshot data is copied and recursively read-only in consumer types. Mutation requires an explicit remote operation or remote reactive value.
- Executable methods do not cross as snapshot data; invocation routes to the owner and is promise-returning in consumer types.
- Named-model information uses collision-free metadata for stable inspection without exposing constructors or permitting remote construction.
- Reissued bodies update an existing hydrated reference without silently replacing its identity.
- Object shape and identity caches are finite and session-scoped.

## Functions and Callbacks

- Either node may issue a local function as a callable remote reference.
- Calling a remote function uses the same authority, correlation, error, validation, middleware, cancellation, budget, and disconnect semantics as other calls and is promise-returning in consumer types.
- Callback intent defines the inverse projection between the owner-side remote callable and the issuing peer's local implementation. Arguments and results retain their nested copy, reference, promise, stream, and plugin-defined kinds in each direction.
- Repeated references to the same function preserve identity during the live session.
- A function passed back to its owner resolves to the original local function.
- Callback reentrancy remains finite and cannot bypass call, depth, or authority limits.
- Releasing or disconnecting a function reference prevents later invocation.

## Pending Promises

- A pending promise may cross as a one-shot remote reference and remains promise-shaped in consumer types without adding nested promise layers.
- Every session that receives a shared pending promise observes one settlement for that promise.
- Resolution values and rejection errors may contain nested remote references and plugin-defined values whose ownership projects in the settlement direction.
- Promise rejection uses the structured platform error representation.
- Duplicate, unknown, late, and forged settlements cannot settle unrelated work or grant authority.
- Disconnect and disposal reject unresolved remote promises and release their state.
- Promises do not use object/function reference-counting semantics after settlement.

## Streams

- Streaming operations are explicit and return ordered async iterables in consumer types rather than promise-wrapped collections.
- Async-iterable results use the default stream projection; explicit stream intent may refine stream-specific policy without changing iteration shape.
- Items remain ordered within one stream. RPC does not imply ordering between independent streams or operations.
- Consumer demand bounds producer permission according to the negotiated flow-control model.
- Producer, transport, and consumer buffers have finite item and byte limits.
- Breaking iteration requests cooperative cancellation and owner-side iterator cleanup.
- Stream arguments and items may be validated and transformed through Standard Schema-compatible rules.
- Stream items may contain any remote value authorized for the receiving session.
- Completion, failure, cancellation, timeout, disconnect, and disposal settle waiters and release stream resources exactly once.
- A slow or malicious stream cannot starve unrelated calls or streams indefinitely.

## Plugin-Defined Values

- Plugins may define copied values, remote-reference kinds, control messages, or lifecycle behavior through RPC plugin-engine hooks.
- Core and plugin-defined values compose recursively in either direction.
- A wire plugin defines how its owner-side value type projects to a consumer type; unsupported values do not pass through the core projection optimistically.
- Plugin message and value namespaces cannot impersonate core kinds or another plugin.
- Required wire plugins must be compatible before their values are transmitted.
- Wire-affecting plugin membership is fixed for the lifetime of the negotiated session.
- Plugin state and traffic consume explicit session budget.
- A plugin cannot grant access to a reference that was not issued to the session.

## Preact Signals

- Preact Signals are provided by an official wire plugin rather than RPC core.
- A remote signal is exposed to consumers as read-only, even when hydration uses writable runtime state internally.
- The first reference includes a current value and ordering context.
- The first observer activates a remote watch; additional local observers do not duplicate it.
- The final observer schedules unwatch with tolerance for brief unmount/remount cycles.
- Watch and unwatch operations are batched, and contradictory pending operations resolve to the final desired state.
- Owner-side source observation exists only while at least one authorized remote observer needs it.
- Updates are ordered per signal. Duplicate and stale updates are harmless; detected gaps trigger bounded recovery rather than uncertain incremental state.
- Local signal writes do not imply owner-side mutation or synchronization.
- Signal identities, watches, revisions, batches, cached values, updates, and recovery remain finite.
- Disconnect removes session watches and invalidates update authority. A new session resynchronizes through newly issued authority.
