import {ServiceContainer} from '.';
import {
  runServiceContainerComplianceTests,
  type ComplianceServiceMap,
} from '@ai.assistant/tests/service-container';

runServiceContainerComplianceTests({
  createContainer: () => new ServiceContainer<ComplianceServiceMap>(),
});
