/** Symbol brand identifying {@link Telemetry} instances across module boundaries. */
export const TELEMETRY_IDENTIFIER = Symbol.for('ai.assistant:Telemetry');

/** Internal symbol storing the namespace string. */
export const TELEMETRY_NAMESPACE = Symbol('ai.assistant:telemetry.namespace');

/** Internal symbol storing the owner/source reference. */
export const TELEMETRY_SOURCE = Symbol('ai.assistant:telemetry.source');

/** Internal symbol storing the default tags for this instance. */
export const TELEMETRY_DEFAULT_TAGS = Symbol('ai.assistant:telemetry.defaultTags');

/** Internal symbol storing the local entry queue. */
export const TELEMETRY_QUEUE = Symbol('ai.assistant:telemetry.queue');

/** Internal symbol storing the child telemetry instances. */
export const TELEMETRY_CHILDREN = Symbol('ai.assistant:telemetry.children');

/** Internal symbol storing the parent telemetry in the fork chain. */
export const TELEMETRY_PARENT = Symbol('ai.assistant:telemetry.parent');

/** Internal symbol storing the disposed flag. */
export const TELEMETRY_DISPOSED = Symbol('ai.assistant:telemetry.disposed');

/** Internal symbol storing the frozen flag. */
export const TELEMETRY_FROZEN = Symbol('ai.assistant:telemetry.frozen');

/** Internal symbol storing the flush interval timer handle. */
export const TELEMETRY_FLUSH_TIMER = Symbol('ai.assistant:telemetry.flushTimer');

/** Internal symbol storing whether auto-flush is active. */
export const TELEMETRY_FLUSHING = Symbol('ai.assistant:telemetry.flushing');

/** Internal symbol storing the autoStart configuration flag. */
export const TELEMETRY_AUTO_START = Symbol('ai.assistant:telemetry.autoStart');

/** Internal symbol storing the configured flush interval in milliseconds. */
export const TELEMETRY_FLUSH_INTERVAL = Symbol('ai.assistant:telemetry.flushInterval');

/** Internal symbol storing pending timer handles for cleanup on dispose. */
export const TELEMETRY_PENDING_TIMERS = Symbol('ai.assistant:telemetry.pendingTimers');

/** Internal symbol storing pending marks for cleanup on dispose. */
export const TELEMETRY_PENDING_MARKS = Symbol('ai.assistant:telemetry.pendingMarks');

/** Internal symbol storing named marks for string-based lookup. */
export const TELEMETRY_MARKS = Symbol('ai.assistant:telemetry.marks');
