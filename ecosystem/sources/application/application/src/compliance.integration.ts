import {runApplicationComplianceTests} from '@ai.assistant/tests/application';
import {Application} from '.';

runApplicationComplianceTests({
  createApplication: (options) => new Application(options),
});
