import type {Telemetry} from '@ai.assistant/contracts/telemetry';
import {Telemetry as TelemetryImpl} from '@ai.assistant/telemetry';

/**
 * Creates a Telemetry instance for testing.
 */
export function createTestTelemetry(namespace?: string): Telemetry {
  return new TelemetryImpl({namespace: namespace ?? 'test'});
}
