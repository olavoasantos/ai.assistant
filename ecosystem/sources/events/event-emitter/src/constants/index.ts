/** Symbol brand identifying {@link Event} instances across module boundaries. */
export const EVENT_IDENTIFIER = Symbol.for('ai.assistant:Event');

/** Symbol brand identifying {@link EventEmitter} instances across module boundaries. */
export const EVENT_EMITTER_IDENTIFIER = Symbol.for('ai.assistant:EventEmitter');

/** Internal symbol storing the event emitter currently handling the event. */
export const EVENT_CURRENT_EMITTER = Symbol('ai.assistant:event.currentEmitter');

/** Internal symbol storing whether an event is currently being dispatched. */
export const EVENT_IS_DISPATCHING = Symbol('ai.assistant:event.isDispatching');

/** Internal symbol storing the emitter listener bucket map. */
export const EVENT_EMITTER_LISTENER_BUCKETS = Symbol('ai.assistant:eventEmitter.listenerBuckets');

/** Internal symbol storing the parent emitter in the bubble tree. */
export const EVENT_EMITTER_PARENT = Symbol('ai.assistant:eventEmitter.parent');

/** Internal symbol storing the event origin emitter. */
export const EVENT_ORIGIN = Symbol('ai.assistant:event.origin');

/** Internal symbol storing the full propagation path for an event. */
export const EVENT_PROPAGATION_PATH = Symbol('ai.assistant:event.propagationPath');

/** Internal symbol storing whether an event has already completed dispatch. */
export const EVENT_WAS_DISPATCHED = Symbol('ai.assistant:event.wasDispatched');
