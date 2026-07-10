import type {EventListener} from '@ai.assistant/contracts/events';

/** Internal listener definition stored inside a pattern bucket. */
export interface ListenerDefinition {
  /** The listener function to invoke. */
  listener: EventListener<any>;

  /** Whether the listener should be removed before its first invocation. */
  once: boolean;

  /** Monotonic registration order used to preserve listener execution order. */
  order: number;
}

/** Internal listener definition paired with the matching pattern key. */
export interface MatchingListenerDefinition extends ListenerDefinition {
  /** The raw pattern that matched the event. */
  pattern: string;
}

/** Internal bucket of listeners for a single raw pattern. */
export interface ListenerBucket {
  /** The compiled matcher for glob patterns, or `null` for exact patterns. */
  matcher: RegExp | null;

  /** The listeners registered for this raw pattern. */
  listeners: ListenerDefinition[];
}
