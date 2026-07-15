/**
 * Telemetry domain types.
 *
 * Defines the metrics collection system used throughout the platform.
 * A lightweight telemetry client with high-resolution timing. Supports
 * timers, value recording, buffered flush, and fork-based namespace
 * scoping with dimensional tags.
 */
import type {EventEmitter} from '../events';

/**
 * The kind of metric an entry represents.
 *
 * - `'timer'` — a duration measurement.
 * - `'value'` — an arbitrary recorded value.
 */
export type TelemetryMetricType = 'timer' | 'value';

/**
 * Dimensional tags attached to telemetry entries.
 *
 * Tags are string key-value pairs used for filtering and grouping metrics.
 */
export type TelemetryTags = Record<string, string>;

/**
 * The outcome status of a telemetry entry.
 *
 * - `'ok'` — the operation completed successfully.
 * - `'error'` — the operation failed.
 */
export type TelemetryStatus = 'ok' | 'error';

/**
 * Options accepted by recording methods.
 *
 * All fields are optional. For timer methods (`startTimer`, `mark`, `measure`),
 * only `tags` is used — `status` and `reason` are determined by the handle's
 * completion method. For `record()`, all fields apply.
 */
export interface TelemetryEntryOptions {
  /** Additional tags to merge with instance and parent defaults. */
  tags?: TelemetryTags;

  /**
   * The outcome status for value entries.
   *
   * @defaultValue 'ok'
   */
  status?: TelemetryStatus;

  /** The failure reason, typically an error object. */
  reason?: unknown;
}

/**
 * Common fields shared by all telemetry entries.
 *
 * @template Metric - The specific metric type discriminant.
 */
export interface TelemetryBaseEntry {
  /** The metric type discriminant. */
  metric: TelemetryMetricType;

  /** The unqualified metric name as passed to the recording method. */
  name: string;

  /** The fully qualified namespaced metric name (e.g. `app.http.request`). */
  namespace: string;

  /** The resolved dimensional tags for this entry. */
  tags: TelemetryTags;

  /** Wall-clock timestamp (`Date.now()`) of when the entry was created. */
  timestamp: number;

  /** The source/owner reference attached to the telemetry instance. */
  source: unknown;

  /** The outcome status of this entry. */
  status: TelemetryStatus;

  /** The failure reason, present when `status` is `'error'`. */
  reason?: unknown;
}

/**
 * A timer entry recording a duration measurement.
 */
export interface TelemetryTimerEntry extends TelemetryBaseEntry {
  /** Discriminant for timer entries. */
  metric: 'timer';

  /** High-resolution start time. */
  startedAt: number;

  /** Duration in milliseconds. */
  duration: number;
}

/**
 * A value entry recording an arbitrary metric value.
 */
export interface TelemetryValueEntry extends TelemetryBaseEntry {
  /** Discriminant for value entries. */
  metric: 'value';

  /** The recorded value. */
  value: unknown;
}

/**
 * Discriminated union of all telemetry entry types.
 */
export type TelemetryEntry = TelemetryTimerEntry | TelemetryValueEntry;

/**
 * Event map for the telemetry subsystem.
 *
 * All telemetry events use the metric's fully qualified namespace followed
 * by the past-tense occurrence `recorded` (for example,
 * `telemetry:app.http.request.recorded`). Listeners can use glob patterns such
 * as `telemetry:*` for all entries or `telemetry:app.http.*` for one namespace.
 */
export type TelemetryEventMap = {[key: `telemetry:${string}.recorded`]: TelemetryEntry};

/**
 * A handle for an in-progress timer measurement.
 *
 * Returned by {@link Telemetry.startTimer} and {@link TelemetryTimerMark.measure}.
 * Completion methods (`stop()`, `fail()`, `cancel()`) are idempotent — calling
 * any of them after the handle is already completed is a silent no-op.
 */
export interface TelemetryTimerHandle {
  /** The resolved tags for this timer. */
  readonly tags: TelemetryTags;

  /**
   * Completes the timer successfully.
   *
   * Completes the measurement, computes duration, and queues the entry
   * with `status: 'ok'`.
   * No-op if the handle has already been completed.
   *
   * @returns The created timer entry, or `undefined` if already completed.
   */
  stop(): TelemetryTimerEntry | undefined;

  /**
   * Completes the timer as a failure.
   *
   * Completes the measurement, computes duration, and queues the entry
   * with `status: 'error'`.
   * No-op if the handle has already been completed.
   *
   * @param reason - Optional failure reason (typically an error object).
   * @returns The created timer entry, or `undefined` if already completed.
   */
  fail(reason?: unknown): TelemetryTimerEntry | undefined;

  /**
   * Cancels the timer without recording an entry.
   *
   * Cleans up resources. No entry is queued.
   * No-op if the handle has already been completed.
   */
  cancel(): void;

  /**
   * Updates an option on this handle before completion.
   *
   * @template Key - The option key to update.
   * @param key - The option field to set.
   * @param value - The new value for the field.
   */
  set<Key extends keyof TelemetryEntryOptions>(key: Key, value: TelemetryEntryOptions[Key]): void;
}

/**
 * A named point in time created by {@link Telemetry.mark}.
 *
 * Marks are reusable — multiple independent measurements can originate
 * from the same mark via {@link measure}.
 */
export interface TelemetryTimerMark {
  /** The unqualified mark name. */
  readonly name: string;

  /** The fully qualified namespaced mark name. */
  readonly namespace: string;

  /** The resolved tags at mark creation time. */
  readonly tags: TelemetryTags;

  /** High-resolution timestamp of when the mark was created. */
  readonly timestamp: number;

  /** The source/owner reference from the telemetry instance. */
  readonly source: unknown;

  /**
   * Removes the mark.
   *
   * Prevents further measurements from this mark.
   *
   * @throws When the mark has already been cleared.
   */
  clear(): void;

  /**
   * Updates an option on this mark.
   *
   * Updated values are inherited by subsequent {@link measure} calls.
   *
   * @template Key - The option key to update.
   * @param key - The option field to set.
   * @param value - The new value for the field.
   */
  set<Key extends keyof TelemetryEntryOptions>(key: Key, value: TelemetryEntryOptions[Key]): void;

  /**
   * Creates a timer handle that measures from this mark.
   *
   * The timer starts at the mark's creation time. Duration is computed
   * when the handle's `stop()` or `fail()` is called.
   *
   * @param name - The metric name for the resulting timer entry.
   * @param opts - Optional tags for the timer.
   * @returns A timer handle to complete the measurement.
   * @throws When the mark has been cleared.
   */
  measure(name: string, opts?: TelemetryEntryOptions): TelemetryTimerHandle;
}

/**
 * Options for constructing a {@link Telemetry} instance.
 */
export interface TelemetryOptions {
  /**
   * The namespace prefix for all metrics from this instance.
   *
   * @defaultValue ''
   */
  namespace?: string;

  /** The source/owner reference stamped on all entries. */
  source?: unknown;

  /** Default tags merged into every entry from this instance. */
  tags?: TelemetryTags;

  /**
   * The flush interval in milliseconds for periodic flushing.
   *
   * @defaultValue 10000
   */
  flushInterval?: number;

  /**
   * A hint for consumers indicating whether flushing should start automatically.
   * The telemetry instance itself never auto-starts flushing.
   *
   * @defaultValue false
   */
  autoStart?: boolean;
}

/**
 * Options for {@link Telemetry.fork}.
 */
export interface TelemetryForkOptions {
  /** Tags specific to the forked child instance. */
  tags?: TelemetryTags;

  /** Override the source/owner reference for the child. */
  source?: unknown;
}

/**
 * Read-only view of a telemetry instance.
 *
 * Returned by {@link Telemetry.freeze}. Exposes only accessor properties.
 */
export interface ReadonlyTelemetry {
  /** The namespace prefix for this instance. */
  readonly namespace: string;

  /** The source/owner reference. */
  readonly source: unknown;

  /** Whether this instance was configured with the autoStart hint. */
  readonly autoStart: boolean;

  /** Whether periodic flushing is currently active. */
  readonly isFlushing: boolean;

  /** The number of entries pending in the queue. */
  readonly size: number;

  /** Whether the queue is empty. */
  readonly isEmpty: boolean;
}

/**
 * Contract for the telemetry client.
 *
 * Extends {@link EventEmitter} so that flushed entries are emitted as events
 * and bubble through the parent-child hierarchy.
 *
 * @example Recording a timer:
 * ```typescript
 * const handle = telemetry.startTimer('db.query');
 * const result = await db.query(sql);
 * handle.stop();
 * ```
 *
 * @example Measuring a callback:
 * ```typescript
 * const result = telemetry.measureCallback('transform', () => {
 *   return expensiveTransform(data);
 * });
 * ```
 *
 * @example Forking with namespace:
 * ```typescript
 * const httpTelemetry = telemetry.fork('http', { tags: { layer: 'transport' } });
 * httpTelemetry.startTimer('request'); // emits as 'telemetry:app.http.request.recorded'
 * ```
 */
export interface Telemetry extends EventEmitter<TelemetryEventMap>, ReadonlyTelemetry {
  /**
   * Starts a timer and returns a handle to complete it.
   *
   * Records the current time. The handle's `stop()` or `fail()` completes
   * the measurement and computes the duration.
   *
   * @param name - The metric name for the timer entry.
   * @param opts - Optional tags.
   * @returns A handle to complete the timing measurement.
   * @throws When the instance is disposed or frozen.
   */
  startTimer(name: string, opts?: TelemetryEntryOptions): TelemetryTimerHandle;

  /**
   * Creates a named point in time for later measurement.
   *
   * Marks are reusable — call `mark.measure(name)` multiple times to create
   * independent timer handles from the same starting point.
   *
   * @param name - The mark name.
   * @param opts - Optional tags inherited by measurements from this mark.
   * @returns A mark object for creating measurements.
   * @throws When the instance is disposed or frozen.
   */
  mark(name: string, opts?: TelemetryEntryOptions): TelemetryTimerMark;

  /**
   * Measures the duration between two existing marks.
   *
   * Computes the duration immediately and records the entry with
   * `status: 'ok'`.
   *
   * @param name - The metric name for the timer entry.
   * @param startMark - The starting mark (name or object).
   * @param endMark - The ending mark (name or object).
   * @param opts - Optional tags.
   * @returns The created timer entry.
   * @throws When a mark name cannot be resolved or the instance is disposed/frozen.
   */
  measure(
    name: string,
    startMark: string | TelemetryTimerMark,
    endMark: string | TelemetryTimerMark,
    opts?: TelemetryEntryOptions,
  ): TelemetryTimerEntry;

  /**
   * Measures the execution of a callback.
   *
   * Starts a timer, invokes `fn()`, and automatically completes the timer.
   * If `fn()` returns a thenable, the timer completes when the promise settles.
   * If `fn()` throws synchronously, the timer is failed and the error re-thrown.
   *
   * @template Result - The return type of the callback.
   * @param name - The metric name for the timer entry.
   * @param fn - The callback to measure.
   * @param opts - Optional tags.
   * @returns The callback's return value (or promise).
   * @throws When the instance is disposed or frozen. Re-throws callback errors.
   */
  measureCallback<Result>(
    name: string,
    fn: (handle: TelemetryTimerHandle) => Result,
    opts?: TelemetryEntryOptions,
  ): Result;

  /**
   * Records an arbitrary value metric.
   *
   * Creates a value entry immediately and pushes it to the queue.
   *
   * @param name - The metric name.
   * @param value - The value to record.
   * @param opts - Optional tags, status, and reason.
   * @throws When the instance is disposed or frozen.
   */
  record(name: string, value: unknown, opts?: TelemetryEntryOptions): void;

  /**
   * Flushes all buffered entries immediately.
   *
   * Cascades depth-first through the fork tree: all children flush before
   * this instance. Each entry is emitted as an event using its qualified
   * namespace followed by `.recorded` as the event type.
   *
   * @throws When the instance has been disposed.
   */
  flush(): void;

  /**
   * Starts periodic automatic flushing.
   *
   * @param opts - Optional override for the flush interval.
   * @throws When the instance has been disposed.
   */
  startFlushing(opts?: {flushInterval?: number}): void;

  /**
   * Stops periodic automatic flushing.
   *
   * Does not flush remaining buffered entries.
   *
   * @throws When the instance has been disposed.
   */
  stopFlushing(): void;

  /**
   * Creates a child telemetry instance with a narrower namespace.
   *
   * The child inherits tags by walking the parent chain and is wired
   * for event bubbling and flush cascading.
   *
   * @param name - The namespace segment to append.
   * @param opts - Optional tags and source overrides.
   * @returns A new child telemetry instance.
   * @throws When the instance has been disposed.
   */
  fork(name: string, opts?: TelemetryForkOptions): Telemetry;

  /**
   * Freezes the instance, preventing new recordings.
   *
   * Flushing remains available. Freeze is one-way — there is no unfreeze.
   *
   * @returns A read-only view of this instance.
   */
  freeze(): ReadonlyTelemetry;

  /**
   * Disposes the instance, releasing all resources.
   *
   * Stops flushing, cancels pending timers and marks, detaches children,
   * clears the queue, and removes this instance from its parent.
   *
   * @throws When the instance has already been disposed.
   */
  dispose(): void;
}
