import type {Executable} from '@ai.assistant/contracts/executable';
import {createRule, Err, Ok} from '@ai.assistant/validation';
import {EXECUTABLE_IDENTIFIER} from '../constants';

/**
 * Validate that an unknown value carries the executable identity brand.
 *
 * The guard uses `Symbol.for('ai.assistant:Executable')` rather than
 * `instanceof`, preserving identity across package copies and realms.
 */
export const ExecutableGuard = createRule<unknown, Executable>({
  name: 'Executable',
  validate(value) {
    if (
      typeof value === 'object' &&
      value !== null &&
      EXECUTABLE_IDENTIFIER in value &&
      value[EXECUTABLE_IDENTIFIER] === true
    ) {
      return Ok(value as unknown as Executable);
    }

    return Err();
  },
});
