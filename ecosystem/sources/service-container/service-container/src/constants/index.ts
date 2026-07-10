/** Symbol brand identifying {@link ServiceContainer} instances across module boundaries. */
export const SERVICE_CONTAINER_IDENTIFIER = Symbol.for('ai.assistant:ServiceContainer');

/** Internal symbol storing the local bindings map. */
export const SERVICE_CONTAINER_BINDINGS = Symbol('ai.assistant:serviceContainer.bindings');

/** Internal symbol storing the parent container in the fork chain. */
export const SERVICE_CONTAINER_PARENT = Symbol('ai.assistant:serviceContainer.parent');

/** Internal symbol storing the frozen flag. */
export const SERVICE_CONTAINER_FROZEN = Symbol('ai.assistant:serviceContainer.frozen');

/** Internal symbol storing the disposed flag. */
export const SERVICE_CONTAINER_DISPOSED = Symbol('ai.assistant:serviceContainer.disposed');

/** Internal symbol storing the set of namespaces currently being resolved. */
export const SERVICE_CONTAINER_RESOLVING = Symbol('ai.assistant:serviceContainer.resolving');

/** Internal symbol storing the resolution order for deterministic disposal. */
export const SERVICE_CONTAINER_RESOLUTION_ORDER = Symbol(
  'ai.assistant:serviceContainer.resolutionOrder',
);

/** Sentinel value indicating a binding has not yet been resolved. */
export const NOT_RESOLVED: unique symbol = Symbol('ai.assistant:serviceContainer.notResolved');
