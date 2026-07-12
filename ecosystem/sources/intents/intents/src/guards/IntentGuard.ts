import type {Intent} from '@ai.assistant/contracts/intents';
import {createRule, Err, Ok} from '@ai.assistant/validation';
import {INTENT_IDENTIFIER} from '../constants';

/** Validate that an unknown value carries the shared Intent brand. */
export const IntentGuard = createRule<unknown, Intent>({
  name: 'Intent',
  validate(value) {
    if (
      typeof value === 'object' &&
      value !== null &&
      INTENT_IDENTIFIER in value &&
      value[INTENT_IDENTIFIER] === true
    ) {
      return Ok(value as unknown as Intent);
    }

    return Err();
  },
});
