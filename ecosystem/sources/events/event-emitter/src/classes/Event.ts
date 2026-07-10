import type * as Contracts from '@ai.assistant/contracts/events';
import {
  EVENT_CURRENT_EMITTER,
  EVENT_IDENTIFIER,
  EVENT_IS_DISPATCHING,
  EVENT_ORIGIN,
  EVENT_PROPAGATION_PATH,
  EVENT_WAS_DISPATCHED,
} from '../constants';

/**
 * An emitted framework event carrying typed details and bubbling state.
 *
 * Events are bubbling-first and intentionally smaller than DOM events. They support:
 *
 * - typed payloads via `event.details`
 * - parent-child bubbling
 * - propagation control via `stopPropagation()` and `stopImmediatePropagation()`
 * - post-emit inspection via `origin` and `propagationPath()`
 *
 * @template Type - The event name.
 * @template Details - The typed payload carried by the event.
 */
export class Event<Type extends string = string, Details = undefined> implements Contracts.Event<
  Type,
  Details
> {
  /** Symbol brand for cross-boundary identity checks. */
  readonly [EVENT_IDENTIFIER] = true as const;

  /** The event name. */
  readonly type: Type;

  /** The typed payload carried by the event. */
  readonly details: Details;

  /** Whether this event bubbles to parent emitters. */
  readonly bubbles: boolean;

  /** @internal The emitter where this event originated. */
  [EVENT_ORIGIN]: Contracts.EventEmitter | null = null;

  /** @internal The emitter currently handling this event. */
  [EVENT_CURRENT_EMITTER]: Contracts.EventEmitter | null = null;

  /** @internal The full propagation path captured during dispatch. */
  [EVENT_PROPAGATION_PATH]: Contracts.EventEmitter[] = [];

  /** @internal Whether this event is currently being dispatched. */
  [EVENT_IS_DISPATCHING] = false;

  /** @internal Whether this event has already been emitted. */
  [EVENT_WAS_DISPATCHED] = false;

  /** @internal Mutable propagation flag backing the public getter. */
  private _propagationStopped = false;

  /** @internal Mutable immediate propagation flag backing the public getter. */
  private _immediatePropagationStopped = false;

  /** The emitter where this event was originally emitted. */
  get origin(): Contracts.EventEmitter | null {
    return this[EVENT_ORIGIN];
  }

  /** The emitter whose listener is currently handling this event. */
  get currentEmitter(): Contracts.EventEmitter | null {
    return this[EVENT_CURRENT_EMITTER];
  }

  /** Whether propagation has been stopped for ancestor emitters. */
  get propagationStopped(): boolean {
    return this._propagationStopped;
  }

  /** Whether remaining listeners on the current emitter should be skipped. */
  get immediatePropagationStopped(): boolean {
    return this._immediatePropagationStopped;
  }

  /**
   * Creates a new event.
   *
   * @param type - The event name.
   * @param options - Event emit options.
   */
  constructor(...[type, options]: Contracts.EventArgs<Type, Details>) {
    this.type = type;
    this.details = options?.details as Details;
    this.bubbles = options?.bubbles ?? true;
  }

  /** Stops propagation to ancestor emitters. */
  stopPropagation(): void {
    this._propagationStopped = true;
  }

  /** Stops propagation and remaining listeners on the current emitter. */
  stopImmediatePropagation(): void {
    this._immediatePropagationStopped = true;
    this.stopPropagation();
  }

  /** Returns the full bubble path captured during emit. */
  propagationPath(): ReadonlyArray<Contracts.EventEmitter> {
    return this[EVENT_PROPAGATION_PATH].slice();
  }
}
