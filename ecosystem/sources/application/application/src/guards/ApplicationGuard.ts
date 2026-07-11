import type {Application} from '@ai.assistant/contracts/application';
import {createRule, Err, Ok} from '@ai.assistant/validation';
import {APPLICATION_IDENTIFIER} from '../constants';

/**
 * Validate that an unknown value carries the application identity brand.
 *
 * The guard uses `Symbol.for('ai.assistant:Application')` rather than
 * `instanceof`, preserving identity across package copies and realms.
 */
export const ApplicationGuard = createRule<unknown, Application>({
  name: 'Application',
  validate(value) {
    if (
      typeof value === 'object' &&
      value !== null &&
      APPLICATION_IDENTIFIER in value &&
      value[APPLICATION_IDENTIFIER] === true
    ) {
      return Ok(value as unknown as Application);
    }

    return Err();
  },
});
