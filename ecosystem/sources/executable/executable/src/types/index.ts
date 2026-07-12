/**
 * Tracks in-flight lifecycle transition promises for concurrency guards.
 *
 * Each key corresponds to a lifecycle direction. A non-null value means
 * that transition is currently in progress.
 */
/** Minimal instance surface used by polymorphic static factories. */
export interface ExecutableFactoryInstance {
  initialize(): Promise<this>;
  activate(): Promise<this>;
}

export interface TransitionState {
  initializing: null | Promise<void>;
  activating: null | Promise<void>;
  deactivating: null | Promise<void>;
  disposing: null | Promise<void>;
}
