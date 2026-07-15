# Charter — telemetry

A minimal telemetry client for collecting system execution data and custom metrics. Any subsystem that needs to measure timing or record values uses this single mechanism. Metrics accumulate in a buffer and flush through a fork tree, giving the platform built-in instrumentation from day one.

## Purpose

Provide the contract surface and behavioural invariants for a metrics collection mechanism shared by all framework and application code. Consumers depend on `@ai.assistant/contracts/telemetry`; one or more source packages implement it and run the shared compliance tests from `@ai.assistant/tests/telemetry`.

## What It Is

- The single metrics collection mechanism for all framework and application code.
- A buffered flush system: metrics accumulate between flushes, then the whole batch cascades depth-first through the fork tree.
- A fork-and-namespace system: child telemetry instances inherit parent tags and prefix all metric names with their namespace.
- A StatsD-inspired data model: two metric types (`timer`, `value`) with dimensional tags.
- An event-backed transport hook: flushed entries are emitted as events on the telemetry instance and bubble through the parent-child hierarchy.

## What It Is Not

- Not a metrics server. It produces metric entries; something else transports them.
- Not an aggregation engine. Counters, gauges, histograms, and distributions are future extensions — the foundation supports only timers and arbitrary values.
- Not a logging framework. It produces structured metric data; it does not format or route log lines.
- Not domain-aware. It knows nothing about users, agents, or product. Domain metric names are chosen by consumers.
- Not async. All operations are synchronous. `measureCallback` handles async callbacks but the telemetry API itself is sync.

## Invariants

### Identity

- `Telemetry` instances are identified by a `Symbol.for('ai.assistant:Telemetry')` brand.
- Identity checks never use `instanceof`. Guards use symbol presence via a validation rule, surviving multiple package versions, bundler deduplication failures, and realm crossings.
- Brand identity is trust-based: objects without the brand symbol are rejected, but any code that knows the brand key string can forge acceptance. This is the deliberate `Symbol.for()` trade-off shared across all foundation modules.

### Timer Lifecycle

- `startTimer(name)` returns a handle with `stop()`, `fail()`, and `cancel()`.
- Timer handles are closure-based. Multiple overlapping timers with the same name are fully independent.
- Timer completion is idempotent: calling `stop()`, `fail()`, or `cancel()` after any prior completion is a silent no-op. The first completion wins. `stop()` and `fail()` return `undefined` on subsequent calls.
- `stop()` records a timer entry with `status: 'ok'`. `fail(reason?)` records with `status: 'error'`. `cancel()` discards — no entry is recorded.
- `stop()` and `fail()` return the created `TelemetryTimerEntry`.
- The handle exposes `set('tags', tags)` to update tags before completion.

### Mark/Measure

- `mark(name)` creates a named point in time and returns a `TelemetryTimerMark`.
- Marks are reusable: multiple independent measurements can originate from the same mark.
- `mark.measure(name)` creates an active timer handle that measures from the mark to whenever `stop()` or `fail()` is called.
- `measure(name, startMark, endMark)` computes duration immediately between two existing marks. Records the entry directly and returns the `TelemetryTimerEntry` — no handle needed since the measurement is a completed fact.
- `mark.clear()` removes the mark. Subsequent calls to `mark.measure()` throw.
- `mark.clear()` is idempotent — double-clear is a silent no-op.
- Marks are tracked for cleanup on dispose.

### measureCallback

- `measureCallback(name, fn)` starts a timer, invokes `fn(handle)`, and automatically calls `stop()` or `fail()` based on the outcome.
- The callback receives the timer handle as its argument, allowing early cancellation or manual completion from within the callback.
- If `fn()` returns a thenable, the method chains resolution/rejection and returns the promise. The timer completes when the promise settles.
- If `fn()` throws synchronously, the timer is failed with the thrown error, and the error is re-thrown.
- The return type matches the callback's return type — `Promise<T>` when async, `T` when sync.

### Value Recording

- `record(name, value, opts?)` creates a value entry immediately and pushes it to the queue.
- Status defaults to `'ok'`. Callers may pass `status: 'error'` and `reason` via options for recording failures.

### Flush Behavior

- `flush()` is synchronous. It cascades depth-first through the fork tree: all children flush before the parent.
- Each instance emits its own entries as events on itself, using `telemetry:{fullyQualifiedMetric}.recorded` as the event type. Events then bubble up through the EventEmitter parent chain.
- A re-entrancy guard prevents infinite recursion: `flush()` called from within a flush listener returns immediately (no-op).
- The queue is snapshot-spliced before emission. Entries recorded during a flush go into the fresh live queue, safe for the next flush cycle.
- `startFlushing(opts?)` enables periodic flushing via an interval. `stopFlushing()` disables it.
- Double-start is idempotent (no-op). Double-stop is idempotent (no-op).

### Fork Semantics

- `fork(name, opts?)` creates a child Telemetry with a concatenated namespace (`parent.name` or just `name` from an empty root).
- The child inherits the parent's tags via live-linked signal resolution. Per-call tags override child tags which override parent tags.
- The child inherits the parent's source unless explicitly overridden.
- The child is wired as an EventEmitter child (events bubble) and as a telemetry child (flush cascades).

### Tag Resolution

- Default tags are live-linked through the fork chain via signals: a parent's tag changes propagate to all descendants automatically.
- Tags resolve by merging the parent chain: root tags → ... → parent tags → instance tags → per-call tags. Later values override earlier on collision.
- Fork options can provide instance-specific tags that merge into the chain.

### Freeze

- `freeze()` prevents all recording methods (`startTimer`, `mark`, `measure`, `measureCallback`, `record`) from accepting new metrics. They throw on a frozen instance.
- `flush()` remains available on a frozen instance.
- `freeze()` returns a `ReadonlyTelemetry` view.
- Freeze is one-way. There is no unfreeze.

### Dispose

- `dispose()` is terminal. After disposal, all public methods except readonly accessors throw.
- Dispose order: stop flushing → cancel all pending timers → cancel all pending marks → detach all children → clear queue → remove from parent → set disposed flag.
- Children are not recursively disposed. They are detached but remain independently usable — they lose tag inheritance and event bubbling from the disposed parent.
- Calling `dispose()` on an already-disposed instance throws.

### autoStart

- `autoStart` is a configuration hint — a boolean flag that consumers read to decide whether to call `startFlushing()`. The telemetry instance itself never auto-starts flushing.

## Extensibility

Future metric types (counters, gauges, histograms, distributions) extend this foundation via additional recording methods and accumulator maps. The queue-based flush architecture supports this — accumulated metrics would be snapshot-emitted alongside queued entries.

The event emission mechanism provides the extensibility hook: consumers subscribe to telemetry events (via glob patterns like `telemetry:app.http.*.recorded`) to build custom backends (transport adapters, console logging, dashboards). Telemetry events are typed through the `TelemetryEventMap` per-emitter type parameter, consistent with the event emitter charter's per-emitter event map approach — no global event registry is involved.

## Constraints

- Environment-agnostic beyond requiring a high-resolution timing source for timer measurements.
- No async in the public API. All operations are synchronous. `measureCallback` returns a promise only when given an async callback.
- Runtime dependencies are limited to other foundations and the platform's reactive primitive.
- The contract lives in `@ai.assistant/contracts/telemetry`; source implementations must satisfy it and run shared compliance tests from `@ai.assistant/tests/telemetry`.
