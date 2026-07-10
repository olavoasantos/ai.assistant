/**
 * Expands a glob pattern into a string path type.
 *
 * Replaces each `*` segment with `${string}`, allowing TypeScript to match
 * glob listener patterns against concrete event names.
 *
 * @template Glob - The glob pattern to expand.
 */
export type GlobToPath<Glob extends string> = Glob extends `${infer Head}*${infer Tail}`
  ? `${Head}${string}${GlobToPath<Tail>}`
  : Glob;

interface EventOptionsWithDetails<Details> {
  /** The payload carried by the event. */
  details: Details;
}

interface EventOptionsWithoutDetails<Details> {
  /** The payload carried by the event. */
  details?: Details;
}

/**
 * Options for dispatching an event.
 *
 * Events whose payload type is `undefined` or `void` may omit `details` entirely.
 * All other event payloads must be provided explicitly.
 *
 * @template Details - The payload type carried on `event.details`.
 */
export type EventOptions<Details> = {
  /**
   * Whether the event bubbles to parent emitters.
   *
   * @defaultValue true
   */
  bubbles?: boolean;
} & ([Details] extends [undefined | void]
  ? EventOptionsWithoutDetails<Details>
  : EventOptionsWithDetails<Details>);

/**
 * Contract for a dispatched event.
 *
 * @template Type - The event name.
 * @template Details - The payload carried on `event.details`.
 */
export interface Event<Type extends string = string, Details = unknown> {
  /** The event name. */
  readonly type: Type;

  /** The typed payload carried by the event. */
  readonly details: Details;

  /** Whether this event bubbles to parent emitters. */
  readonly bubbles: boolean;

  /** The emitter where this event was originally dispatched. */
  readonly origin: EventEmitter | null;

  /** The emitter whose listener is currently handling this event. */
  readonly currentEmitter: EventEmitter | null;

  /** Whether propagation has been stopped for ancestor emitters. */
  readonly propagationStopped: boolean;

  /** Whether remaining listeners on the current emitter should be skipped. */
  readonly immediatePropagationStopped: boolean;

  /** Stops propagation to ancestor emitters. */
  stopPropagation(): void;

  /** Stops propagation and remaining listeners on the current emitter. */
  stopImmediatePropagation(): void;

  /** Returns the full bubble path from origin to root. */
  propagationPath(): ReadonlyArray<EventEmitter>;
}

/**
 * Listener function invoked for matching events.
 *
 * @template DispatchedEvent - The concrete event shape received by the listener.
 */
export interface EventListener<DispatchedEvent extends Event = Event> {
  /**
   * Handles a dispatched event.
   *
   * @param event - The event being handled.
   */
  (event: DispatchedEvent): void;
}

/**
 * Matches all events in an event map against a glob pattern.
 *
 * If the event map is not keyed by literal event names and instead exposes a broad
 * string index, the result falls back to a general `Event<string, unknown>`.
 *
 * @template Glob - The glob pattern used for matching.
 * @template EventMap - The event map to match against.
 */
export type MatchGlobEvents<Glob extends string, EventMap extends Record<string, any>> =
  string extends Extract<keyof EventMap, string>
    ? Event<string, unknown>
    : {
        [Type in Extract<keyof EventMap, string>]: Type extends GlobToPath<Glob>
          ? Event<Type, EventMap[Type]>
          : never;
      }[Extract<keyof EventMap, string>];

/**
 * Contract for the bubbling event emitter.
 *
 * @template EventMap - The event map supported by this emitter.
 */
export interface EventEmitter<EventMap extends Record<string, any> = any> {
  /**
   * Registers a listener for an event name or glob pattern.
   *
   * Returns a cleanup function that removes the listener.
   *
   * @template Glob - The event name or glob pattern.
   * @param pattern - The event name or glob pattern to subscribe to.
   * @param listener - The listener to invoke for matching events.
   * @returns A function that removes the listener.
   */
  on<const Glob extends string>(
    pattern: Glob,
    listener: EventListener<MatchGlobEvents<Glob, EventMap>>,
  ): () => void;

  /**
   * Registers a one-shot listener for an event name or glob pattern.
   *
   * Returns a cleanup function that removes the listener before it fires.
   *
   * @template Glob - The event name or glob pattern.
   * @param pattern - The event name or glob pattern to subscribe to.
   * @param listener - The listener to invoke for the first matching event.
   * @returns A function that removes the listener.
   */
  once<const Glob extends string>(
    pattern: Glob,
    listener: EventListener<MatchGlobEvents<Glob, EventMap>>,
  ): () => void;

  /**
   * Removes a previously registered listener.
   *
   * @template Glob - The event name or glob pattern used during registration.
   * @param pattern - The event name or glob pattern.
   * @param listener - The listener to remove.
   */
  off<const Glob extends string>(
    pattern: Glob,
    listener: EventListener<MatchGlobEvents<Glob, EventMap>>,
  ): void;

  /**
   * Emits a new event from an event name and options.
   *
   * @template Type - The concrete event name being emitted.
   * @param args - Tuple containing the event name and emit options.
   * @returns The emitted event instance.
   */
  emit<Type extends Extract<keyof EventMap, string>>(
    ...args: EventArgs<Type, EventMap[Type]>
  ): Event<Type, EventMap[Type]>;

  /**
   * Emits an existing event instance.
   *
   * @template Type - The concrete event name being emitted.
   * @param event - The event instance to emit.
   * @returns The emitted event instance.
   */
  emit<Type extends Extract<keyof EventMap, string>>(
    event: Event<Type, EventMap[Type]>,
  ): Event<Type, EventMap[Type]>;

  /**
   * Adds a child emitter whose events bubble to this emitter.
   *
   * Returns a cleanup function that detaches the child.
   *
   * @param child - The child emitter to attach.
   * @returns A function that detaches the child emitter.
   */
  addChild(child: EventEmitter): () => void;

  /**
   * Removes a previously attached child emitter.
   *
   * @param child - The child emitter to detach.
   */
  removeChild(child: EventEmitter): void;
}

/**
 * Tuple of arguments accepted by `emit(type, options)`.
 *
 * Payload types `undefined` and `void` may omit the options item entirely.
 * All other payloads must provide dispatch options explicitly, even when the
 * payload itself may include `undefined` as part of a wider union.
 *
 * @template Type - The concrete event name being dispatched.
 * @template Details - The payload type carried on `event.details`.
 */
export type EventArgs<Type extends string, Details> = [Details] extends [undefined | void]
  ? [type: Type, options?: EventOptions<Details>]
  : [type: Type, options: EventOptions<Details>];
