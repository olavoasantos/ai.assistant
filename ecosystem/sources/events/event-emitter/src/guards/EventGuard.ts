import type {Event} from '@ai.assistant/contracts/events';
import {createRule, Err, Ok} from '@ai.assistant/validation';
import {EVENT_IDENTIFIER} from '../constants';

/**
 * Validates that an unknown value is a branded {@link Event} instance.
 *
 * Uses the `Symbol.for('ai.assistant:Event')` brand for identification, making it
 * reliable across module boundaries, package versions, and JavaScript realms.
 *
 * @example
 * ```ts
 * if (EventGuard.is(value)) {
 *   // value is narrowed to Event
 *   console.log(value.type, value.details);
 * }
 * ```
 */
export const EventGuard = createRule<unknown, Event>({
  name: 'Event',
  validate(value) {
    if (
      typeof value === 'object' &&
      value !== null &&
      EVENT_IDENTIFIER in value &&
      value[EVENT_IDENTIFIER] === true
    ) {
      return Ok(value as unknown as Event);
    }

    return Err();
  },
});
