# Charter — @ai.assistant/event-emitter

## Purpose

A typed, bubbling event emitter for the entire platform. Any subsystem that needs to broadcast or listen for named events uses this single mechanism. Events carry typed payloads, bubble through parent-child hierarchies, and support glob-pattern subscriptions.

## What It Is

- The single event dispatch mechanism for all framework and application code.
- A parent-child bubbling system: events flow from the origin emitter up through ancestors.
- A glob-pattern subscription system: listeners can match families of events (e.g. `tool:*`).
- A typed payload carrier: each event name maps to a specific payload type through the emitter's `EventMap` type parameter.

## What It Is Not

- Not an async message queue. Dispatch is synchronous. Listeners execute in registration order during `emit()`.
- Not a pub/sub broker. There is no network transport, no persistence, no replay.
- Not an observable/signal system. Events are discrete occurrences, not continuous values.
- Not domain-aware. It knows nothing about tools, sessions, agents, or product. Domain event maps are supplied as the emitter's `EventMap` type parameter.

## Invariants

### Identity

- `Event` instances are identified by a `Symbol.for('ai.assistant:Event')` brand.
- `EventEmitter` instances are identified by a `Symbol.for('ai.assistant:EventEmitter')` brand.
- Identity checks never use `instanceof`. Guards use symbol presence via validation rules, surviving multiple package versions, bundler deduplication failures, and realm crossings.
- Brand identity is trust-based: objects without the brand symbol are rejected, but any code that knows the brand key string can forge acceptance. This is the deliberate `Symbol.for()` trade-off shared across all foundation modules.

### Event Names

- Typed occurrence events follow `{domain}:{dot.notation.pastTenseVerb}`.
- The emitter dispatches arbitrary string event maps without rewriting or runtime-validating names; the subsystem declaring an event map owns naming compliance.
- Glob selectors may end in `*` because they match event families rather than announce occurrences.

### Event Lifecycle

- An event can only be emitted once. Re-emitting a previously dispatched event throws.
- During dispatch, `event.origin` is the emitter where `emit()` was called.
- During dispatch, `event.currentEmitter` tracks which emitter's listeners are currently executing.
- After dispatch completes, `event.currentEmitter` resets to `null`.
- Listener exceptions are isolated: if a listener throws, remaining listeners and bubbling continue. After all listeners have run, the first caught error is re-thrown to the `emit()` caller.
- After dispatch completes (regardless of errors), the event is marked as dispatched and cannot be re-emitted.

### Bubbling

- Events bubble by default (`bubbles: true`).
- The propagation path is captured at dispatch time: origin → parent → grandparent → ... → root.
- `stopPropagation()` prevents the event from reaching ancestor emitters. Remaining listeners on the current emitter still execute.
- `stopImmediatePropagation()` prevents remaining listeners on the current emitter AND prevents bubbling.
- Non-bubbling events (`bubbles: false`) only dispatch to listeners on the origin emitter.

### Parent-Child Hierarchy

- Each emitter has at most one parent. Single-parent constraint is enforced at `addChild` time.
- Reparenting is automatic: calling `addChild` on a new parent detaches the child from its current parent first, then attaches to the new one.
- Adding the same child to the same parent is idempotent (silent no-op, returns a new cleanup function).
- Self-attachment throws (an emitter cannot be its own child).
- Cycle detection: if attaching a child would create a loop in the ancestor chain, it throws.
- `addChild()` returns a cleanup function that detaches the child. Cleanup functions are safe to call multiple times.

### Listener Registration

- `on(pattern, listener)` registers a persistent listener. Returns a cleanup function.
- `once(pattern, listener)` registers a one-shot listener. Removed before its first invocation, even if the listener throws.
- `off(pattern, listener)` removes a previously registered listener. No-op for unregistered patterns or listeners.
- Cleanup functions returned by `on()` and `once()` are safe to call multiple times.
- Duplicate registrations for the same pattern and listener are ignored. The first registration wins (preserves `on` vs `once` mode).
- Listeners execute in global registration order across all matching patterns. A glob and an exact pattern registered in sequence fire in that sequence.
- The listener snapshot is captured at the start of each emitter's dispatch. Listeners added during dispatch do not fire in the current cycle. Listeners removed during dispatch still fire if already in the snapshot.

### Glob Patterns

- Patterns containing `*` match event names where `*` expands to any substring.
- `tool:*` matches `tool:started`, `tool:ended`, etc.
- Exact patterns (no `*`) use strict equality matching.

### Emit Overloads

- `emit(type, options?)` constructs a new event and dispatches it.
- `emit(event)` dispatches a pre-constructed branded `Event` instance.
- The `emit(event)` form requires a branded event (verified via guard). Structural look-alikes are rejected.

### Payload Typing

- Events whose payload type is `undefined` or `void` may omit the options argument entirely.
- All other event payloads require explicit `{ details: T }` in the options.
- Union types that include `undefined` (e.g. `string | undefined`) still require explicit options — they are not the same as a purely `undefined` payload.

## Extensibility

Event payloads are typed through the `EventMap` generic parameter on `EventEmitter<EventMap>` and `Event<Type, Details>`. Domain packages declare their own event map types and instantiate emitters against them:

```typescript
import {EventEmitter} from '@ai.assistant/event-emitter';

interface ToolEvents {
  'tool:started': {toolId: string};
  'tool:ended': {toolId: string; success: boolean};
  'turn:ended': undefined;
}

const emitter = new EventEmitter<ToolEvents>();
emitter.on('tool:*', (event) => {
  console.log(event.type, event.details.toolId);
});
```

This keeps the foundation generic while giving each consuming subsystem type-safe, locally-scoped event maps without a global registry.

## Constraints

- Zero external runtime dependencies beyond other foundations (`@ai.assistant/error`, `@ai.assistant/helpers`, `@ai.assistant/validation`).
- Environment-agnostic: works in browsers, Node, workers, edge runtimes.
- No async. All operations are synchronous. Listeners are invoked synchronously during `emit()`.
- The contract lives in `@ai.assistant/contracts/events`. This module implements it. The TypeScript compiler enforces alignment.
