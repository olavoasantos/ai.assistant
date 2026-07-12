import type {Activity} from '@ai.assistant/contracts/intents';
import {createRule, Err, Ok} from '@ai.assistant/validation';
import {ACTIVITY_IDENTIFIER} from '../constants';

/** Validate that an unknown value carries the shared Activity brand. */
export const ActivityGuard = createRule<unknown, Activity>({
  name: 'Activity',
  validate(value) {
    if (
      typeof value === 'object' &&
      value !== null &&
      ACTIVITY_IDENTIFIER in value &&
      value[ACTIVITY_IDENTIFIER] === true
    ) {
      return Ok(value as unknown as Activity);
    }

    return Err();
  },
});
