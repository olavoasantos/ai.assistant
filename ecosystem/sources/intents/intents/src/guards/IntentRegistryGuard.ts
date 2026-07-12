import type {IntentRegistry} from '@ai.assistant/contracts/intents';
import {createRule, Err, Ok} from '@ai.assistant/validation';
import {INTENT_REGISTRY_IDENTIFIER} from '../constants';

/** Validate that an unknown value carries the shared IntentRegistry brand. */
export const IntentRegistryGuard = createRule<unknown, IntentRegistry>({
  name: 'IntentRegistry',
  validate(value) {
    if (
      typeof value === 'object' &&
      value !== null &&
      INTENT_REGISTRY_IDENTIFIER in value &&
      value[INTENT_REGISTRY_IDENTIFIER] === true
    ) {
      return Ok(value as unknown as IntentRegistry);
    }

    return Err();
  },
});
