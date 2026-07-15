# RPC Remote Values

This document is part of the normative [RPC charter](./README.md).

## Root Capability Directory

- A client session receives one stable root facade after connection establishes readiness.
- The facade is live within that session: committed server exposure changes update future root-path resolution without replacing the facade.
- Root updates preserve committed order. Missing or invalid updates trigger bounded recovery or session termination rather than uncertain authority.
- A top-level root property may designate copied data or remote references according to its value kind.
- Exposure replacement or removal does not mutate copied values already received or revoke remote references already issued.
- A root facade belongs to exactly one session and remains stale after disconnect, even when the client reconnects to the same server.

## Values by Copy

- Primitive values, arrays, and plain data records cross by copy unless a negotiated wire plugin handles them differently.
- Copied values have no ongoing remote identity, mutation, or synchronization relationship.
- Repeated occurrences of a copied value do not promise reference equality after hydration.
- Nested remote references retain their own identity and authority semantics.
- Cyclic or unsupported copied graphs fail safely unless a negotiated value kind explicitly represents them.
- String and raw transports may support different copied platform values, but those representation differences do not change remote-reference semantics.

## Objects and Models

- Behavior-bearing objects and named models may cross as remote references.
- Repeated references to the same owner-side object resolve to one hydrated identity while the receiving session retains that reference.
- The first reference may carry a safe snapshot of non-reactive data so consumers can read it immediately.
- Snapshot data is copied. Local mutation does not mutate the owner unless an explicit remote operation or remote reactive value defines that behavior.
- Executable methods do not cross as snapshot data; invocation routes to the owner.
- Named-model or class information may support stable inspection and membership without permitting remote construction.
- Reissued bodies update an existing hydrated reference without silently replacing its identity.
- Object shape and identity caches are finite and session-scoped.

## Functions and Callbacks

- Either node may issue a local function as a callable remote reference.
- Calling a remote function uses the same authority, correlation, error, validation, middleware, cancellation, budget, and disconnect semantics as other calls.
- Repeated references to the same function preserve identity during the live session.
- A function passed back to its owner resolves to the original local function.
- Callback reentrancy remains finite and cannot bypass call, depth, or authority limits.
- Releasing or disconnecting a function reference prevents later invocation.

## Pending Promises

- A pending promise may cross as a one-shot remote reference.
- Every session that receives a shared pending promise observes one settlement for that promise.
- Resolution values and rejection errors may contain nested remote references and plugin-defined values.
- Promise rejection uses the structured platform error representation.
- Duplicate, unknown, late, and forged settlements cannot settle unrelated work or grant authority.
- Disconnect and disposal reject unresolved remote promises and release their state.
- Promises do not use object/function reference-counting semantics after settlement.

## Streams

- Streaming operations are explicit and return ordered iterables remotely.
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
