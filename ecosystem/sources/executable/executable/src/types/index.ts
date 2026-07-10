/**
 * Tracks in-flight lifecycle transition promises for concurrency guards.
 *
 * Each key corresponds to a lifecycle direction. A non-null value means
 * that transition is currently in progress.
 */
export interface TransitionState {
  initializing: null | Promise<void>;
  activating: null | Promise<void>;
  deactivating: null | Promise<void>;
  disposing: null | Promise<void>;
}
