import type {EventEmitter as EventEmitterContract} from '@ai.assistant/contracts/events';
import type {ReadonlySignal, Signal} from '@ai.assistant/contracts/signals';
import type {
  ReadonlyTelemetry,
  Telemetry as TelemetryContract,
  TelemetryEntryOptions,
  TelemetryEventMap,
  TelemetryForkOptions,
  TelemetryOptions,
  TelemetryTags,
  TelemetryTimerEntry,
  TelemetryTimerHandle,
  TelemetryTimerMark,
  TelemetryValueEntry,
} from '@ai.assistant/contracts/telemetry';
import {ApplicationError} from '@ai.assistant/error';
import {EventEmitter} from '@ai.assistant/event-emitter';
import {generateId} from '@ai.assistant/helpers';
import {computed, signal} from '@preact/signals-core';
import {
  TELEMETRY_AUTO_START,
  TELEMETRY_CHILDREN,
  TELEMETRY_DEFAULT_TAGS,
  TELEMETRY_DISPOSED,
  TELEMETRY_FLUSH_INTERVAL,
  TELEMETRY_FLUSH_TIMER,
  TELEMETRY_FLUSHING,
  TELEMETRY_FROZEN,
  TELEMETRY_IDENTIFIER,
  TELEMETRY_MARKS,
  TELEMETRY_NAMESPACE,
  TELEMETRY_PARENT,
  TELEMETRY_PENDING_MARKS,
  TELEMETRY_PENDING_TIMERS,
  TELEMETRY_QUEUE,
  TELEMETRY_SOURCE,
} from '../constants';
import type {QueuedEntry} from '../types';

/**
 * A minimal, Performance API-backed telemetry client for the platform.
 *
 * Records StatsD-inspired metrics (timers and arbitrary values) with
 * namespace scoping, dimensional tagging, and buffered flush semantics.
 * All timing measurements use `performance.mark()` and `performance.measure()`
 * for sub-millisecond accuracy and devtools timeline integration.
 *
 * Each instance maintains its own local queue. Flushing cascades depth-first
 * through the fork tree: children flush before the parent. Each instance
 * emits its own entries as events on itself, using the fully qualified
 * namespace as the event type. Events then bubble up through the
 * EventEmitter parent chain.
 *
 * @example
 * ```ts
 * const telemetry = new Telemetry({ namespace: 'app' });
 *
 * const handle = telemetry.startTimer('db.query');
 * // ... do work ...
 * handle.stop();
 *
 * telemetry.record('config.loaded', { keys: 42 });
 * telemetry.flush(); // emits entries as events
 * ```
 */
export class Telemetry extends EventEmitter<TelemetryEventMap> implements TelemetryContract {
  /** Symbol brand for cross-boundary identity checks. */
  readonly [TELEMETRY_IDENTIFIER] = true as const;

  /** @internal The namespace string for this instance. */
  [TELEMETRY_NAMESPACE]: string;

  /** @internal The owner/source reference. */
  [TELEMETRY_SOURCE]: unknown;

  /** @internal Signal holding the local default tags for this instance. */
  [TELEMETRY_DEFAULT_TAGS]: Signal<TelemetryTags>;

  /** @internal Entry queue. */
  [TELEMETRY_QUEUE]: QueuedEntry[] = [];

  /** @internal Child telemetry instances for flush cascading. */
  [TELEMETRY_CHILDREN]: Set<Telemetry> = new Set();

  /** @internal Signal holding the parent telemetry in the fork chain. */
  [TELEMETRY_PARENT]: Signal<Telemetry | null> = signal(null);

  /** @internal Whether this instance has been disposed. */
  [TELEMETRY_DISPOSED] = false;

  /** @internal Whether this instance is frozen against writes. */
  [TELEMETRY_FROZEN] = false;

  /** @internal The periodic flush interval timer handle. */
  [TELEMETRY_FLUSH_TIMER]: ReturnType<typeof setInterval> | null = null;

  /** @internal Whether auto-flush is active. */
  [TELEMETRY_FLUSHING] = false;

  /** @internal The configured autoStart flag. */
  [TELEMETRY_AUTO_START]: boolean;

  /** @internal The configured flush interval in milliseconds. */
  [TELEMETRY_FLUSH_INTERVAL]: number | undefined;

  /** @internal Pending timer handles for cleanup on dispose. */
  [TELEMETRY_PENDING_TIMERS]: Set<TelemetryTimerHandle> = new Set();

  /** @internal Pending marks for cleanup on dispose. */
  [TELEMETRY_PENDING_MARKS]: Set<TelemetryTimerMark> = new Set();

  /** @internal Named marks for string-based lookup. */
  [TELEMETRY_MARKS]: Map<string, TelemetryTimerMark> = new Map();

  /** @internal Computed signal for resolved default tags including parent chain. */
  private resolvedTags: ReadonlySignal<TelemetryTags>;

  /** @internal Guard against recursive flush. */
  private isFlushing_ = false;

  /**
   * Creates a new telemetry instance.
   *
   * @param options - Configuration options for this instance.
   */
  constructor(options?: TelemetryOptions) {
    super();
    this[TELEMETRY_NAMESPACE] = options?.namespace ?? '';
    this[TELEMETRY_SOURCE] = options?.source;
    this[TELEMETRY_DEFAULT_TAGS] = signal(options?.tags ?? {});
    this[TELEMETRY_AUTO_START] = options?.autoStart ?? false;
    this[TELEMETRY_FLUSH_INTERVAL] = options?.flushInterval;
    this.resolvedTags = computed(() => this.resolveDefaultTags());
  }

  /** The namespace prefix for this telemetry instance. */
  get namespace(): string {
    return this[TELEMETRY_NAMESPACE];
  }

  /** The source object attached to entries from this instance. */
  get source(): unknown {
    return this[TELEMETRY_SOURCE];
  }

  /** Whether this instance was configured with the autoStart hint. */
  get autoStart(): boolean {
    return this[TELEMETRY_AUTO_START];
  }

  /** Whether periodic flushing is currently active. */
  get isFlushing(): boolean {
    return this[TELEMETRY_FLUSHING];
  }

  /**
   * The number of pending entries waiting to be flushed.
   *
   * @throws {ApplicationError} When the instance has been disposed.
   */
  get size(): number {
    this.ensureNotDisposed();
    return this[TELEMETRY_QUEUE].length;
  }

  /**
   * Whether the entry buffer is empty.
   *
   * @throws {ApplicationError} When the instance has been disposed.
   */
  get isEmpty(): boolean {
    return this.size === 0;
  }

  /**
   * Starts a timer and returns a handle to complete it.
   *
   * @param name - The metric name for the timer entry.
   * @param opts - Optional tags.
   * @returns A handle to complete the timing measurement.
   * @throws {ApplicationError} When the instance is disposed or frozen.
   */
  startTimer(name: string, opts?: TelemetryEntryOptions): TelemetryTimerHandle {
    this.ensureRecordable();
    const tags = this.resolveTags(opts?.tags);
    const markId = generateId('telemetry');
    const startMark = performance.mark(markId);

    return this.createActiveTimerHandle(name, tags, markId, startMark.startTime);
  }

  /**
   * Creates a named point in time for later measurement.
   *
   * @param name - The mark name.
   * @param opts - Optional tags inherited by measurements from this mark.
   * @returns A mark object for creating measurements.
   * @throws {ApplicationError} When the instance is disposed or frozen.
   */
  mark(name: string, opts?: TelemetryEntryOptions): TelemetryTimerMark {
    this.ensureRecordable();
    const tags = this.resolveTags(opts?.tags);
    const markId = generateId('telemetry');
    const perfMark = performance.mark(markId);
    let canceled = false;
    let markTags = {...tags};

    const mark: TelemetryTimerMark & {_markId: string; _canceled: boolean} = {
      _markId: markId,
      get _canceled() {
        return canceled;
      },
      get name() {
        return name;
      },
      namespace: this.qualifiedName(name),
      get tags() {
        return markTags;
      },
      timestamp: perfMark.startTime,
      source: this[TELEMETRY_SOURCE],

      clear: () => {
        if (canceled) {
          return;
        }
        canceled = true;
        performance.clearMarks(markId);
        this[TELEMETRY_PENDING_MARKS].delete(mark);
        if (this[TELEMETRY_MARKS].get(name) === mark) {
          this[TELEMETRY_MARKS].delete(name);
        }
      },

      set: <Key extends keyof TelemetryEntryOptions>(
        key: Key,
        value: TelemetryEntryOptions[Key],
      ) => {
        if (key === 'tags') {
          markTags = {...markTags, ...(value as TelemetryTags)};
        }
      },

      measure: (measureName: string, measureOpts?: TelemetryEntryOptions): TelemetryTimerHandle => {
        if (canceled) {
          throw new ApplicationError('Cannot measure from a cleared mark.');
        }
        const measureTags = this.resolveTags({...markTags, ...measureOpts?.tags});
        return this.createActiveTimerHandle(
          measureName,
          measureTags,
          markId,
          perfMark.startTime,
          false,
        );
      },
    };

    this[TELEMETRY_PENDING_MARKS].add(mark);
    this[TELEMETRY_MARKS].set(name, mark);
    return mark;
  }

  /**
   * Measures the duration between two existing marks.
   *
   * @param name - The metric name for the timer entry.
   * @param startMark - The starting mark (name or object).
   * @param endMark - The ending mark (name or object).
   * @param opts - Optional tags.
   * @returns The created timer entry.
   * @throws {ApplicationError} When a mark name cannot be resolved or the instance is disposed/frozen.
   */
  measure(
    name: string,
    startMark: string | TelemetryTimerMark,
    endMark: string | TelemetryTimerMark,
    opts?: TelemetryEntryOptions,
  ): TelemetryTimerEntry {
    this.ensureRecordable();
    const tags = this.resolveTags(opts?.tags);

    const resolvedStart = this.resolveMark(startMark);
    const resolvedEnd = this.resolveMark(endMark);

    const startMarkObj = resolvedStart as any;
    const endMarkObj = resolvedEnd as any;
    if (startMarkObj._markId == null || endMarkObj._markId == null) {
      throw new ApplicationError('Cannot measure between marks that lack internal mark IDs.');
    }

    const measureId = generateId('telemetry');
    const measurement = performance.measure(measureId, startMarkObj._markId, endMarkObj._markId);
    const duration = measurement.duration;
    const startedAt = resolvedStart.timestamp;
    performance.clearMeasures(measureId);

    const entry: TelemetryTimerEntry = {
      metric: 'timer',
      name,
      namespace: this.qualifiedName(name),
      tags,
      timestamp: Date.now(),
      source: this[TELEMETRY_SOURCE],
      status: 'ok',
      startedAt,
      duration,
    };
    this[TELEMETRY_QUEUE].push({name, entry});
    return entry;
  }

  /**
   * Measures the execution of a callback.
   *
   * @template Result - The return type of the callback.
   * @param name - The metric name for the timer entry.
   * @param fn - The callback to measure.
   * @param opts - Optional tags.
   * @returns The callback's return value (or promise).
   * @throws {ApplicationError} When the instance is disposed or frozen. Re-throws callback errors.
   */
  measureCallback<Result>(
    name: string,
    fn: (handle: TelemetryTimerHandle) => Result,
    opts?: TelemetryEntryOptions,
  ): Result {
    const handle = this.startTimer(name, opts);
    try {
      const result = fn(handle);
      if (result != null && typeof (result as any).then === 'function') {
        return Promise.resolve(result).then(
          (value: unknown) => {
            handle.stop();
            return value;
          },
          (error: unknown) => {
            handle.fail(error);
            throw error;
          },
        ) as Result;
      }
      handle.stop();
      return result;
    } catch (error) {
      handle.fail(error);
      throw error;
    }
  }

  /**
   * Records an arbitrary value metric.
   *
   * @param name - The metric name.
   * @param value - The value to record.
   * @param opts - Optional tags, status, and reason.
   * @throws {ApplicationError} When the instance is disposed or frozen.
   */
  record(name: string, value: unknown, opts?: TelemetryEntryOptions): void {
    this.ensureRecordable();
    const tags = this.resolveTags(opts?.tags);
    const entry: TelemetryValueEntry = {
      metric: 'value',
      name,
      namespace: this.qualifiedName(name),
      tags,
      timestamp: Date.now(),
      source: this[TELEMETRY_SOURCE],
      status: opts?.status ?? 'ok',
      reason: opts?.reason,
      value,
    };
    this[TELEMETRY_QUEUE].push({name, entry});
  }

  /**
   * Flushes all buffered entries immediately.
   *
   * @throws {ApplicationError} When the instance has been disposed.
   */
  flush(): void {
    this.ensureNotDisposed();

    if (this.isFlushing_) {
      return;
    }

    this.isFlushing_ = true;
    try {
      for (const child of this[TELEMETRY_CHILDREN]) {
        child.flush();
      }

      const queueSnapshot = this[TELEMETRY_QUEUE].splice(0);
      const errors: unknown[] = [];

      for (const queued of queueSnapshot) {
        try {
          const eventType = `telemetry:${this.qualifiedName(queued.name)}` as const;
          this.emit(eventType, {details: queued.entry});
        } catch (error) {
          errors.push(error);
        }
      }

      if (errors.length > 0) {
        throw errors[0];
      }
    } finally {
      this.isFlushing_ = false;
    }
  }

  /**
   * Starts periodic automatic flushing.
   *
   * @param opts - Optional override for the flush interval.
   * @throws {ApplicationError} When the instance has been disposed.
   */
  startFlushing(opts?: {flushInterval?: number}): void {
    this.ensureNotDisposed();

    if (this[TELEMETRY_FLUSHING]) {
      return;
    }

    const interval = opts?.flushInterval ?? this[TELEMETRY_FLUSH_INTERVAL] ?? 10_000;
    this[TELEMETRY_FLUSH_TIMER] = setInterval(() => {
      this.flush();
    }, interval);
    this[TELEMETRY_FLUSHING] = true;
  }

  /**
   * Stops periodic automatic flushing.
   *
   * @throws {ApplicationError} When the instance has been disposed.
   */
  stopFlushing(): void {
    this.ensureNotDisposed();

    if (!this[TELEMETRY_FLUSHING]) {
      return;
    }

    if (this[TELEMETRY_FLUSH_TIMER] != null) {
      clearInterval(this[TELEMETRY_FLUSH_TIMER]);
      this[TELEMETRY_FLUSH_TIMER] = null;
    }
    this[TELEMETRY_FLUSHING] = false;
  }

  /**
   * Creates a child telemetry instance with a narrower namespace.
   *
   * @param name - The namespace segment to append.
   * @param opts - Optional tags and source overrides.
   * @returns A new child telemetry instance.
   * @throws {ApplicationError} When the instance has been disposed.
   */
  fork(name: string, opts?: TelemetryForkOptions): Telemetry {
    this.ensureNotDisposed();

    const childNamespace =
      this[TELEMETRY_NAMESPACE] !== '' ? `${this[TELEMETRY_NAMESPACE]}.${name}` : name;

    const child = new Telemetry({
      namespace: childNamespace,
      source: opts?.source ?? this[TELEMETRY_SOURCE],
      flushInterval: this[TELEMETRY_FLUSH_INTERVAL],
      tags: opts?.tags,
    });

    this.addChild(child);
    return child;
  }

  /**
   * Freezes the instance, preventing new recordings.
   *
   * @returns A read-only view of this instance.
   */
  freeze(): ReadonlyTelemetry {
    this[TELEMETRY_FROZEN] = true;
    return this;
  }

  /**
   * Adds a child emitter and registers it for flush cascading.
   *
   * @param child - The child emitter to attach.
   * @returns A function that detaches the child emitter.
   */
  override addChild(child: EventEmitterContract): () => void {
    const cleanup = super.addChild(child);
    if (this.isTelemetryInstance(child)) {
      const telemetryChild = child as Telemetry;
      this[TELEMETRY_CHILDREN].add(telemetryChild);
      telemetryChild[TELEMETRY_PARENT].value = this;
    }
    return cleanup;
  }

  /**
   * Removes a previously attached child emitter.
   *
   * @param child - The child emitter to detach.
   */
  override removeChild(child: EventEmitterContract): void {
    super.removeChild(child);
    if (this.isTelemetryInstance(child)) {
      const telemetryChild = child as Telemetry;
      this[TELEMETRY_CHILDREN].delete(telemetryChild);
      telemetryChild[TELEMETRY_PARENT].value = null;
    }
  }

  /**
   * Disposes the instance, releasing all resources.
   *
   * @throws {ApplicationError} When the instance has already been disposed.
   */
  dispose(): void {
    this.ensureNotDisposed();

    if (this[TELEMETRY_FLUSHING]) {
      this.stopFlushing();
    }

    for (const handle of this[TELEMETRY_PENDING_TIMERS]) {
      handle.cancel();
    }
    this[TELEMETRY_PENDING_TIMERS].clear();

    for (const mark of this[TELEMETRY_PENDING_MARKS]) {
      mark.clear();
    }
    this[TELEMETRY_PENDING_MARKS].clear();

    this[TELEMETRY_MARKS].clear();

    const children = Array.from(this[TELEMETRY_CHILDREN]);
    for (const child of children) {
      this.removeChild(child);
    }

    this[TELEMETRY_QUEUE].length = 0;

    if (this[TELEMETRY_PARENT].value != null) {
      this[TELEMETRY_PARENT].value.removeChild(this);
    }

    this[TELEMETRY_DISPOSED] = true;
  }

  /** Resolves the effective default tags via reactive parent chain. */
  private resolveDefaultTags(): TelemetryTags {
    const parent = this[TELEMETRY_PARENT].value;
    const parentTags = parent != null ? parent.resolvedTags.value : {};
    return {...parentTags, ...this[TELEMETRY_DEFAULT_TAGS].value};
  }

  /** Merges resolved default tags with per-call tags. */
  private resolveTags(callTags?: TelemetryTags): TelemetryTags {
    const defaults = this.resolvedTags.value;
    if (callTags == null) {
      return defaults;
    }
    return {...defaults, ...callTags};
  }

  /** Builds the fully qualified namespaced metric name. */
  private qualifiedName(name: string): string {
    return this[TELEMETRY_NAMESPACE] !== '' ? `${this[TELEMETRY_NAMESPACE]}.${name}` : name;
  }

  /** Resolves a mark reference (string or object) to a TelemetryTimerMark. */
  private resolveMark(mark: string | TelemetryTimerMark): TelemetryTimerMark {
    if (typeof mark === 'string') {
      const resolved = this[TELEMETRY_MARKS].get(mark);
      if (resolved == null) {
        throw new ApplicationError(`Mark "${mark}" not found.`);
      }
      return resolved;
    }
    if ((mark as any)._canceled === true) {
      throw new ApplicationError('Cannot use a cleared mark.');
    }
    return mark;
  }

  /**
   * Creates an active timer handle (end time unknown).
   * Used by startTimer() and mark.measure().
   * @param ownsStartMark - If true, the handle cleans up startMarkId on all completions.
   *   If false (borrowed mark), only cancel skips clearing the start mark.
   */
  private createActiveTimerHandle(
    name: string,
    tags: TelemetryTags,
    startMarkId: string,
    startedAt: number,
    ownsStartMark = true,
  ): TelemetryTimerHandle {
    let completed = false;
    let handleTags = {...tags};

    const handle: TelemetryTimerHandle = {
      get tags() {
        return handleTags;
      },

      stop: (): TelemetryTimerEntry | undefined => {
        if (completed) {
          return undefined;
        }
        completed = true;
        this[TELEMETRY_PENDING_TIMERS].delete(handle);

        const endMarkId = generateId('telemetry');
        performance.mark(endMarkId);
        const measureId = generateId('telemetry');
        const measurement = performance.measure(measureId, startMarkId, endMarkId);
        const duration = measurement.duration;

        performance.clearMarks(endMarkId);
        performance.clearMeasures(measureId);
        if (ownsStartMark) {
          performance.clearMarks(startMarkId);
        }

        const entry: TelemetryTimerEntry = {
          metric: 'timer',
          name,
          namespace: this.qualifiedName(name),
          tags: handleTags,
          timestamp: Date.now(),
          source: this[TELEMETRY_SOURCE],
          status: 'ok',
          startedAt,
          duration,
        };
        this[TELEMETRY_QUEUE].push({name, entry});
        return entry;
      },

      fail: (reason?: unknown): TelemetryTimerEntry | undefined => {
        if (completed) {
          return undefined;
        }
        completed = true;
        this[TELEMETRY_PENDING_TIMERS].delete(handle);

        const endMarkId = generateId('telemetry');
        performance.mark(endMarkId);
        const measureId = generateId('telemetry');
        const measurement = performance.measure(measureId, startMarkId, endMarkId);
        const duration = measurement.duration;

        performance.clearMarks(endMarkId);
        performance.clearMeasures(measureId);
        if (ownsStartMark) {
          performance.clearMarks(startMarkId);
        }

        const entry: TelemetryTimerEntry = {
          metric: 'timer',
          name,
          namespace: this.qualifiedName(name),
          tags: handleTags,
          timestamp: Date.now(),
          source: this[TELEMETRY_SOURCE],
          status: 'error',
          reason,
          startedAt,
          duration,
        };
        this[TELEMETRY_QUEUE].push({name, entry});
        return entry;
      },

      cancel: (): void => {
        if (completed) {
          return undefined;
        }
        completed = true;
        this[TELEMETRY_PENDING_TIMERS].delete(handle);
        if (ownsStartMark) {
          performance.clearMarks(startMarkId);
        }
      },

      set: <Key extends keyof TelemetryEntryOptions>(
        key: Key,
        value: TelemetryEntryOptions[Key],
      ): void => {
        if (key === 'tags') {
          handleTags = {...handleTags, ...(value as TelemetryTags)};
        }
      },
    };

    this[TELEMETRY_PENDING_TIMERS].add(handle);
    return handle;
  }

  /** Checks if a value is a Telemetry instance via brand symbol. */
  private isTelemetryInstance(value: unknown): boolean {
    return (
      typeof value === 'object' &&
      value !== null &&
      TELEMETRY_IDENTIFIER in value &&
      (value as any)[TELEMETRY_IDENTIFIER] === true
    );
  }

  /**
   * Throws if the instance has been disposed.
   *
   * @throws {ApplicationError} When the instance has been disposed.
   */
  private ensureNotDisposed(): void {
    if (this[TELEMETRY_DISPOSED]) {
      throw new ApplicationError('Cannot use a disposed telemetry instance.');
    }
  }

  /**
   * Throws if the instance is frozen or disposed.
   *
   * @throws {ApplicationError} When the instance is disposed or frozen.
   */
  private ensureRecordable(): void {
    this.ensureNotDisposed();
    if (this[TELEMETRY_FROZEN]) {
      throw new ApplicationError('Cannot record metrics on a frozen telemetry instance.');
    }
  }
}
