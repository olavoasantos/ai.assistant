import {ApplicationError, ErrorIssue} from '.';
import {runErrorComplianceTests} from '@ai.assistant/tests/error';

runErrorComplianceTests({
  ApplicationError: async (options) => new ApplicationError(options),
  ErrorIssue: async (options) => new ErrorIssue(options),
  normalizeError: async (value) => ApplicationError.from(value),
  normalizeIssue: async (value) => ErrorIssue.from(value),
});
