import {Telemetry} from '.';
import {runTelemetryComplianceTests} from '@ai.assistant/tests/telemetry';

runTelemetryComplianceTests({
  createTelemetry: (options) => new Telemetry(options),
});
