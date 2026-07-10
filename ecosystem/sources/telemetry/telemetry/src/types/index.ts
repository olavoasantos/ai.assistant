import type {TelemetryEntry} from '@ai.assistant/contracts/telemetry';

/** An individual entry waiting in the local queue for flush. */
export interface QueuedEntry {
  /** The unqualified metric name. */
  name: string;

  /** The fully constructed telemetry entry ready for emission. */
  entry: TelemetryEntry;
}
