import type {Signal} from '@preact/signals-core';
import type {
  ServiceDisposer,
  ServiceFactory,
  ServiceResolution,
} from '@ai.assistant/contracts/service-container';
import type {NOT_RESOLVED} from '../constants';

/** Internal representation of a service binding stored in the container. */
export interface InternalBinding<Value = unknown> {
  /** The namespace key that identifies this binding. */
  namespace: string;

  /** The factory function that creates the service value. */
  factory: ServiceFactory<Value>;

  /** How the binding resolves and caches its value. */
  resolution: ServiceResolution;

  /** Signal holding the cached value for value/singleton/scoped bindings. `null` for transient. */
  cached: Signal<Value | typeof NOT_RESOLVED> | null;

  /** Optional disposal function called when the container is disposed. */
  dispose?: ServiceDisposer<Value>;
}
