import {Executable} from '.';
import {runExecutableComplianceTests} from '@ai.assistant/tests/executable';

runExecutableComplianceTests({
  createExecutable: (options) => new Executable(options),
});
