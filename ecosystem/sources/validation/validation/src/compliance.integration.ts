import {createRule, Err, Ok} from '.';
import {runValidationComplianceTests} from '@ai.assistant/tests/validation';

runValidationComplianceTests({
  createRule,
  Ok,
  Err,
});
