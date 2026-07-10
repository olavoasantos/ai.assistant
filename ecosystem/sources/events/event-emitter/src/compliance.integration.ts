import {Event, EventEmitter} from '.';
import {runEventComplianceTests, type ComplianceEventMap} from '@ai.assistant/tests/events';

runEventComplianceTests({
  createEmitter: () => new EventEmitter<ComplianceEventMap>(),
  createEvent: (...args) => new Event(...args),
});
