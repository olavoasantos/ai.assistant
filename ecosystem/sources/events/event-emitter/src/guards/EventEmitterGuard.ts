import type {EventEmitter} from '@ai.assistant/contracts/events';
import {createRule, Err, Ok} from '@ai.assistant/validation';
import {EVENT_EMITTER_IDENTIFIER} from '../constants';

/**
 * Validates that an unknown value is a branded {@link EventEmitter} instance.
 *
 * Uses the `Symbol.for('ai.assistant:EventEmitter')` brand for identification, making it
 * reliable across module boundaries, package versions, and JavaScript realms.
 *
 * @example
 * ```ts
 * if (EventEmitterGuard.is(value)) {
 *   // value is narrowed to EventEmitter
 *   value.on('some:event', listener);
 * }
 * ```
 */
export const EventEmitterGuard = createRule<unknown, EventEmitter>({
  name: 'EventEmitter',
  validate(value) {
    if (
      typeof value === 'object' &&
      value !== null &&
      EVENT_EMITTER_IDENTIFIER in value &&
      value[EVENT_EMITTER_IDENTIFIER] === true
    ) {
      return Ok(value as unknown as EventEmitter);
    }

    return Err();
  },
});
