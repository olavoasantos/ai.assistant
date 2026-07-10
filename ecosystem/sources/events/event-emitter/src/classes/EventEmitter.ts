import type * as Contracts from '@ai.assistant/contracts/events';
import {ApplicationError} from '@ai.assistant/error';
import {globToRegex} from '@ai.assistant/helpers/utilities/globToRegex';
import {
  EVENT_CURRENT_EMITTER,
  EVENT_EMITTER_IDENTIFIER,
  EVENT_EMITTER_LISTENER_BUCKETS,
  EVENT_EMITTER_PARENT,
  EVENT_IDENTIFIER,
  EVENT_IS_DISPATCHING,
  EVENT_ORIGIN,
  EVENT_PROPAGATION_PATH,
  EVENT_WAS_DISPATCHED,
} from '../constants';
import type {ListenerBucket, MatchingListenerDefinition} from '../types';
import {Event} from './Event';

/**
 * A typed, bubbling event emitter for the platform.
 *
 * The emitter is intentionally smaller than DOM `EventTarget` and focuses on the
 * semantics this framework actually needs:
 *
 * - typed payloads via `event.details`
 * - parent-child bubbling
 * - glob listener patterns such as `tool:*`
 * - cleanup-returning listener registration
 * - explicit child attach/detach semantics
 *
 * @template EventMap - The event map supported by this emitter.
 */
export class EventEmitter<
  EventMap extends Record<string, any> = Record<string, any>,
> implements Contracts.EventEmitter<EventMap> {
  /** Symbol brand for cross-boundary identity checks. */
  readonly [EVENT_EMITTER_IDENTIFIER] = true as const;

  /** @internal Listener buckets keyed by raw pattern. */
  [EVENT_EMITTER_LISTENER_BUCKETS]: Map<string, ListenerBucket> = new Map();

  /** @internal Parent emitter in the bubble tree. */
  [EVENT_EMITTER_PARENT]: EventEmitter<EventMap> | null = null;

  /** @internal Monotonic registration counter preserving listener order. */
  private _listenerOrder = 0;

  /**
   * Registers a listener for an event name or glob pattern.
   *
   * @template Glob - The event name or glob pattern.
   * @param pattern - The event name or glob pattern to subscribe to.
   * @param listener - The listener to invoke for matching events.
   * @returns A function that removes the listener.
   */
  on<const Glob extends string>(
    pattern: Glob,
    listener: Contracts.EventListener<Contracts.MatchGlobEvents<Glob, EventMap>>,
  ): () => void {
    return this.registerListener(pattern, listener, false);
  }

  /**
   * Registers a one-shot listener for an event name or glob pattern.
   *
   * @template Glob - The event name or glob pattern.
   * @param pattern - The event name or glob pattern to subscribe to.
   * @param listener - The listener to invoke for the first matching event.
   * @returns A function that removes the listener before it fires.
   */
  once<const Glob extends string>(
    pattern: Glob,
    listener: Contracts.EventListener<Contracts.MatchGlobEvents<Glob, EventMap>>,
  ): () => void {
    return this.registerListener(pattern, listener, true);
  }

  /**
   * Removes a previously registered listener.
   *
   * @template Glob - The event name or glob pattern used during registration.
   * @param pattern - The event name or glob pattern.
   * @param listener - The listener to remove.
   */
  off<const Glob extends string>(
    pattern: Glob,
    listener: Contracts.EventListener<Contracts.MatchGlobEvents<Glob, EventMap>>,
  ): void {
    const bucket = this[EVENT_EMITTER_LISTENER_BUCKETS].get(pattern);
    if (bucket == null) {
      return;
    }

    bucket.listeners = bucket.listeners.filter((definition) => definition.listener !== listener);
    if (bucket.listeners.length === 0) {
      this[EVENT_EMITTER_LISTENER_BUCKETS].delete(pattern);
    }
  }

  /**
   * Emits a new event from an event name and options.
   *
   * @template Type - The concrete event name being emitted.
   * @param args - Tuple containing the event name and emit options.
   * @returns The emitted event instance.
   * @throws {ApplicationError} When re-emitting an event that is already dispatched or dispatching.
   */
  emit<Type extends Extract<keyof EventMap, string>>(
    ...args: Contracts.EventArgs<Type, EventMap[Type]>
  ): Event<Type, EventMap[Type]>;
  /**
   * Emits an existing event instance.
   *
   * @template Type - The concrete event name being emitted.
   * @param event - The event instance to emit.
   * @returns The emitted event instance.
   * @throws {ApplicationError} When re-emitting an event that is already dispatched or dispatching.
   * @throws {ApplicationError} When the event is not an instance created by this package.
   */
  emit<Type extends Extract<keyof EventMap, string>>(
    event: Contracts.Event<Type, EventMap[Type]>,
  ): Event<Type, EventMap[Type]>;
  emit<Type extends Extract<keyof EventMap, string>>(
    typeOrEvent: Contracts.Event<Type, EventMap[Type]> | Type,
    options?: Contracts.EventOptions<EventMap[Type]>,
  ): Event<Type, EventMap[Type]> {
    const event =
      typeof typeOrEvent === 'string'
        ? new Event(typeOrEvent, options)
        : this.resolveEvent(typeOrEvent);

    if (event[EVENT_IS_DISPATCHING] || event[EVENT_WAS_DISPATCHED]) {
      throw new ApplicationError('Cannot re-emit an event that is already in use.');
    }

    event[EVENT_IS_DISPATCHING] = true;
    event[EVENT_ORIGIN] = this;
    event[EVENT_PROPAGATION_PATH] = this.buildPropagationPath(event.bubbles);
    const errors: unknown[] = [];

    try {
      for (const emitter of event[EVENT_PROPAGATION_PATH] as EventEmitter[]) {
        event[EVENT_CURRENT_EMITTER] = emitter;
        const listeners = emitter.collectMatchingListeners(event.type);

        for (const definition of listeners) {
          if (definition.once) {
            emitter.off(definition.pattern, definition.listener);
          }

          try {
            definition.listener(event);
          } catch (error) {
            errors.push(error);
          }

          if (event.immediatePropagationStopped) {
            break;
          }
        }

        if (event.propagationStopped) {
          break;
        }
      }
    } finally {
      event[EVENT_CURRENT_EMITTER] = null;
      event[EVENT_IS_DISPATCHING] = false;
      event[EVENT_WAS_DISPATCHED] = true;
    }

    if (errors.length > 0) {
      throw errors[0];
    }

    return event as Event<Type, EventMap[Type]>;
  }

  /**
   * Adds a child emitter whose events bubble to this emitter.
   *
   * @param child - The child emitter to attach.
   * @returns A function that detaches the child emitter.
   * @throws {ApplicationError} When the child is the same instance as this emitter.
   * @throws {ApplicationError} When attaching the child would create a cycle in the bubble tree.
   * @throws {ApplicationError} When the child is the emitter itself or would create a cycle.
   */
  addChild(child: Contracts.EventEmitter): () => void {
    const childEmitter = this.resolveEmitter(child);

    if (childEmitter === this) {
      throw new ApplicationError('An event emitter cannot be added as its own child.');
    }

    if (this.createsCycle(childEmitter)) {
      throw new ApplicationError('Adding this child would create an event emitter cycle.');
    }

    if (childEmitter[EVENT_EMITTER_PARENT] != null && childEmitter[EVENT_EMITTER_PARENT] !== this) {
      childEmitter[EVENT_EMITTER_PARENT].removeChild(
        childEmitter as unknown as Contracts.EventEmitter,
      );
    }

    childEmitter[EVENT_EMITTER_PARENT] = this;
    return () => {
      this.removeChild(childEmitter);
    };
  }

  /**
   * Removes a previously attached child emitter.
   *
   * @param child - The child emitter to detach.
   */
  removeChild(child: Contracts.EventEmitter): void {
    const childEmitter = this.resolveEmitter(child);
    if (childEmitter[EVENT_EMITTER_PARENT] === this) {
      childEmitter[EVENT_EMITTER_PARENT] = null;
    }
  }

  /** Registers a listener in the appropriate bucket. */
  private registerListener<Glob extends string>(
    pattern: Glob,
    listener: Contracts.EventListener<Contracts.MatchGlobEvents<Glob, EventMap>>,
    once: boolean,
  ): () => void {
    const existingBucket = this[EVENT_EMITTER_LISTENER_BUCKETS].get(pattern);
    const bucket =
      existingBucket ??
      ({
        matcher: pattern.includes('*') ? globToRegex(pattern) : null,
        listeners: [],
      } satisfies ListenerBucket);

    // Duplicate registrations for the same pattern and listener are ignored.
    // The first registration wins, so mixing `on()` and `once()` does not
    // upgrade or downgrade an existing listener definition.
    if (!bucket.listeners.some((definition) => definition.listener === listener)) {
      bucket.listeners.push({
        listener,
        once,
        order: this._listenerOrder,
      });
      this._listenerOrder += 1;
    }

    if (existingBucket == null) {
      this[EVENT_EMITTER_LISTENER_BUCKETS].set(pattern, bucket);
    }

    return () => {
      this.off(pattern, listener);
    };
  }

  /** Collects matching listeners in global registration order. */
  private collectMatchingListeners(type: string): MatchingListenerDefinition[] {
    const listeners: MatchingListenerDefinition[] = [];

    for (const [pattern, bucket] of this[EVENT_EMITTER_LISTENER_BUCKETS].entries()) {
      const matches = bucket.matcher == null ? pattern === type : bucket.matcher.test(type);
      if (!matches) {
        continue;
      }

      for (const definition of bucket.listeners) {
        listeners.push({...definition, pattern});
      }
    }

    listeners.sort((left, right) => left.order - right.order);
    return listeners;
  }

  /** Builds the bubble path for an emit operation. */
  private buildPropagationPath(bubbles: boolean): EventEmitter[] {
    const path: EventEmitter<any>[] = [this];
    if (!bubbles) {
      return path;
    }

    let current = this[EVENT_EMITTER_PARENT];
    while (current != null) {
      path.push(current);
      current = current[EVENT_EMITTER_PARENT];
    }

    return path;
  }

  /** Returns whether attaching the child would create a cycle. */
  private createsCycle(child: EventEmitter<EventMap>): boolean {
    let current = this[EVENT_EMITTER_PARENT];
    while (current != null) {
      if (current === child) {
        return true;
      }
      current = current[EVENT_EMITTER_PARENT];
    }

    return false;
  }

  /**
   * Resolves a structural event into the concrete runtime event implementation.
   * Brand check mirrors EventGuard logic — kept inline for emit() hot path performance.
   */
  private resolveEvent<Type extends Extract<keyof EventMap, string>>(
    event: Contracts.Event<Type, EventMap[Type]>,
  ): Event<Type, EventMap[Type]> {
    if (
      typeof event !== 'object' ||
      event === null ||
      !(EVENT_IDENTIFIER in event) ||
      event[EVENT_IDENTIFIER] !== true
    ) {
      throw new ApplicationError(
        'emit(event) requires an Event instance created by @ai.assistant/event-emitter.',
      );
    }

    return event as unknown as Event<Type, EventMap[Type]>;
  }

  /**
   * Resolves a structural emitter into the concrete runtime emitter implementation.
   * Brand check mirrors EventEmitterGuard logic — kept inline for addChild/removeChild performance.
   */
  private resolveEmitter(emitter: Contracts.EventEmitter): EventEmitter<EventMap> {
    if (
      typeof emitter !== 'object' ||
      emitter === null ||
      !(EVENT_EMITTER_IDENTIFIER in emitter) ||
      emitter[EVENT_EMITTER_IDENTIFIER] !== true
    ) {
      throw new ApplicationError(
        'Child emitters must be EventEmitter instances created by @ai.assistant/event-emitter.',
      );
    }

    return emitter as unknown as EventEmitter<EventMap>;
  }
}
